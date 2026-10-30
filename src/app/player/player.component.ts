import { Component, OnInit, HostListener, OnDestroy, AfterViewInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { VgApiService } from '@videogular/ngx-videogular/core';
import { PostsService } from 'app/posts.services';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { ShareMediaDialogComponent } from '../dialogs/share-media-dialog/share-media-dialog.component';
import { DatabaseFile, FileType, Playlist } from '../../api-types';
import { TwitchChatComponent } from 'app/components/twitch-chat/twitch-chat.component';
import { VideoInfoDialogComponent } from 'app/dialogs/video-info-dialog/video-info-dialog.component';
import { Subscription } from 'rxjs';
import { filter, take } from 'rxjs/operators';

export interface IMedia {
  title: string;
  src: string;
  type: string;
  label: string;
  url: string;
  uid?: string;
}

@Component({
  selector: 'app-player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.css']
})
export class PlayerComponent implements OnInit, AfterViewInit, OnDestroy {

  playlist: Array<IMedia> = [];
  original_playlist: string = null;
  playlist_updating = false;

  show_player = false;

  currentIndex = 0;
  currentItem: IMedia = null;
  api: VgApiService;
  api_ready = false;

  // params
  uids: string[];
  type: FileType;
  playlist_id = null; // used for playlists (not subscription)
  file_objs: DatabaseFile[] = []; // used for playlists
  uid = null; // used for non-subscription files (audio, video, playlist)
  subscription = null;
  sub_id = null;
  subPlaylist = null;
  uuid = null; // used for sharing in multi-user mode, uuid is the user that downloaded the video
  timestamp = null;
  auto = null;

  db_playlist: Playlist = null;
  db_file: DatabaseFile = null;

  baseStreamPath = null;
  audioFolderPath = null;
  videoFolderPath = null;
  subscriptionFolderPath = null;

  // url-mode params
  url = null;
  name = null;

  downloading = false;
  playerActionLabels = {
    downloadPlaylist: $localize`:Download playlist action@@playerDownloadPlaylistAction:Download playlist`,
    share: $localize`:Share media action@@playerShareAction:Share`,
    downloadFile: $localize`:Download file action@@playerDownloadFileAction:Download file`,
    fileInfo: $localize`:File information action@@playerFileInfoAction:File information`,
    twitchChat: $localize`:Twitch chat action@@playerTwitchChatAction:Twitch chat`
  };

  save_volume_timer = null;
  original_volume = null;
  route_subscription: Subscription = null;
  initialization_subscription: Subscription = null;
  data_request: Subscription = null;
  view_count_request: Subscription = null;
  download_request: Subscription = null;
  loaded_metadata_subscription: Subscription = null;
  ended_subscription: Subscription = null;
  request_generation = 0;
  destroyed = false;

  @ViewChild('twitchchat') twitchChat: TwitchChatComponent;

  ngOnInit(): void {
    this.route_subscription = this.route.paramMap.subscribe(paramMap => {
      this.applyRouteParams(paramMap);
      if (this.postsService.initialized) this.processConfig();
      else this.waitForInitialization();
    });
  }

  ngAfterViewInit(): void {
    this.cdr.detectChanges();
    this.postsService.sidenav.close();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.route_subscription?.unsubscribe();
    this.initialization_subscription?.unsubscribe();
    this.resetRouteState();
  }

  constructor(public postsService: PostsService, private route: ActivatedRoute, private dialog: MatDialog, private router: Router,
              private cdr: ChangeDetectorRef) {

  }

  applyRouteParams(paramMap: ParamMap): void {
    this.resetRouteState();
    this.playlist_id = paramMap.get('playlist_id');
    this.uid = paramMap.get('uid');
    this.sub_id = paramMap.get('sub_id');
    this.url = paramMap.get('url');
    this.name = paramMap.get('name');
    this.uuid = paramMap.get('uuid');
    this.timestamp = paramMap.get('timestamp');
    this.auto = paramMap.get('auto');
  }

  waitForInitialization(): void {
    if (this.initialization_subscription) return;
    const initializationSubscription = this.postsService.service_initialized.pipe(
      filter(init => init),
      take(1)
    ).subscribe(() => {
      if (!this.destroyed) this.processConfig();
    });
    this.initialization_subscription = initializationSubscription.closed ? null : initializationSubscription;
  }

  processConfig(): void {
    this.baseStreamPath = this.postsService.path;
    this.audioFolderPath = this.postsService.config['Downloader']['path-audio'];
    this.videoFolderPath = this.postsService.config['Downloader']['path-video'];
    this.subscriptionFolderPath = this.postsService.config['Subscriptions']['subscriptions_base_path'];

    if (this.sub_id) {
      this.getSubscription();
    } else if (this.playlist_id) {
      this.getPlaylistFiles();
    } else if (this.uid) {
      this.getFile();
    } 

    if (this.url) {
      // if a url is given, just stream the URL
      this.playlist = [];
      const imedia: IMedia = {
        title: this.name,
        label: this.name,
        src: this.url,
        type: 'video/mp4',
        url: this.url,
        uid: this.uid
      }
      this.playlist.push(imedia);
      this.updateCurrentItem(this.playlist[0], 0);
      this.show_player = true;
    }
  }

  getFile(): void {
    const requestGeneration = this.request_generation;
    const requestedUid = this.uid;
    this.data_request?.unsubscribe();
    const request = this.postsService.getFile(requestedUid, this.uuid).subscribe(res => {
      if (requestGeneration !== this.request_generation || requestedUid !== this.uid) return;
      this.db_file = res['file'];
      if (!this.db_file) {
        this.postsService.openSnackBar($localize`Failed to get file information from the server.`, 'Dismiss');
        return;
      }
      this.view_count_request?.unsubscribe();
      const viewCountRequest = this.postsService.incrementViewCount(this.db_file['uid'], null, this.uuid).subscribe(() => undefined, () => {
        console.error('Failed to increment view count');
        if (requestGeneration === this.request_generation) this.view_count_request = null;
      }, () => {
        if (requestGeneration === this.request_generation) this.view_count_request = null;
      });
      this.view_count_request = viewCountRequest.closed ? null : viewCountRequest;
      // regular video/audio file (not playlist)
      this.uids = [this.db_file['uid']];
      this.type = this.db_file['isAudio'] ? 'audio' as FileType : 'video' as FileType;
      this.parseFileNames();
    }, () => {
      this.finishDataRequest(requestGeneration);
    }, () => {
      this.finishDataRequest(requestGeneration);
    });
    this.data_request = request.closed ? null : request;
  }

  getSubscription(): void {
    const requestGeneration = this.request_generation;
    const requestedSubscriptionId = this.sub_id;
    this.data_request?.unsubscribe();
    const request = this.postsService.getSubscription(requestedSubscriptionId).subscribe(res => {
      if (requestGeneration !== this.request_generation || requestedSubscriptionId !== this.sub_id) return;
      const subscription = res['subscription'];
      this.subscription = subscription;
      this.type = this.subscription.type;
      this.uids = this.subscription.videos.map(video => video['uid']);
      this.parseFileNames();
    }, () => {
      if (requestGeneration !== this.request_generation || requestedSubscriptionId !== this.sub_id) return;
      // TODO: Make translatable
      this.postsService.openSnackBar(`Failed to find subscription ${requestedSubscriptionId}`, 'Dismiss');
      this.finishDataRequest(requestGeneration);
    }, () => {
      this.finishDataRequest(requestGeneration);
    });
    this.data_request = request.closed ? null : request;
  }

  getPlaylistFiles(): void {
    const requestGeneration = this.request_generation;
    const requestedPlaylistId = this.playlist_id;
    this.data_request?.unsubscribe();
    const request = this.postsService.getPlaylist(requestedPlaylistId, this.uuid, true).subscribe(res => {
      if (requestGeneration !== this.request_generation || requestedPlaylistId !== this.playlist_id) return;
      if (res['playlist']) {
        this.db_playlist = res['playlist'];
        this.file_objs = res['file_objs'];
        this.uids = this.db_playlist.uids;
        this.type = res['type'];
        this.show_player = true;
        this.parseFileNames();
      } else {
        this.postsService.openSnackBar($localize`Failed to load playlist!`);
      }
    }, () => {
      if (requestGeneration !== this.request_generation || requestedPlaylistId !== this.playlist_id) return;
      this.postsService.openSnackBar($localize`Failed to load playlist!`);
      this.finishDataRequest(requestGeneration);
    }, () => {
      this.finishDataRequest(requestGeneration);
    });
    this.data_request = request.closed ? null : request;
  }

  parseFileNames(): void {    
    this.playlist = [];
    for (let i = 0; i < this.uids.length; i++) {
      let file_obj = null;
      if (this.playlist_id) {
        file_obj = this.file_objs[i];
      } else if (this.sub_id) {
        file_obj = this.subscription['videos'][i];
      } else {
        file_obj = this.db_file;
      }

      const mime_type = file_obj.isAudio ? 'audio/mp3' : 'video/mp4' 

      const baseLocation = 'stream/';
      let fullLocation = this.baseStreamPath + baseLocation + `?test=test&uid=${file_obj['uid']}`;

      if (this.postsService.isLoggedIn) {
        fullLocation += `&jwt=${this.postsService.token}`;
      }
      
      if (this.uuid) {
        fullLocation += `&uuid=${this.uuid}`;
      }

      if (this.sub_id) {
        fullLocation += `&sub_id=${this.sub_id}`;
      } else if (this.playlist_id) {
        fullLocation += `&playlist_id=${this.playlist_id}`;
      }

      const mediaObject: IMedia = {
        title: file_obj['title'],
        src: fullLocation,
        type: mime_type,
        label: file_obj['title'],
        url: file_obj['url'],
        uid: file_obj['uid']
      }
      this.playlist.push(mediaObject);
    }
    if (this.db_playlist && this.db_playlist['randomize_order']) {
      this.shuffleArray(this.playlist);
    }
    this.currentItem = this.playlist[this.currentIndex];
    this.original_playlist = JSON.stringify(this.playlist);
    this.show_player = true;
  }

  onPlayerReady(api: VgApiService): void {
      this.stopMediaTracking();
      this.api = api;
      this.api_ready = true;
      this.cdr.detectChanges();

      // checks if volume has been previously set. if so, use that as default
      if (localStorage.getItem('player_volume')) {
        this.api.volume = parseFloat(localStorage.getItem('player_volume'));
      }

      this.save_volume_timer = setInterval(() => this.saveVolume(this.api), 2000)

      this.loaded_metadata_subscription = this.api.getDefaultMedia().subscriptions.loadedMetadata.subscribe(this.playVideo.bind(this));
      this.ended_subscription = this.api.getDefaultMedia().subscriptions.ended.subscribe(this.nextVideo.bind(this));

      if (this.timestamp) {
        this.api.seekTime(+this.timestamp);
      }
  }

  saveVolume(api: VgApiService): void {
    if (this.original_volume !== api.volume) {
      localStorage.setItem('player_volume', api.volume)
      this.original_volume = api.volume;
    }
  }

  nextVideo(): void {
      if (this.currentIndex === this.playlist.length - 1) {
        // dont continue playing
          // this.currentIndex = 0;
          return;
      }

      this.updateCurrentItem(this.playlist[this.currentIndex], ++this.currentIndex);
  }

  updateCurrentItem(newCurrentItem: IMedia, newCurrentIndex: number) {
    this.currentItem  = newCurrentItem;
    this.currentIndex = newCurrentIndex;
  }

  playVideo(): void {
      this.api.play();
  }

  onClickPlaylistItem(item: IMedia, index: number): void {
      this.currentIndex = index;
      this.currentItem = item;
      this.updateCurrentItem(this.currentItem, this.currentIndex);
  }

  getFileNames(): string[] {
    const fileNames = [];
    for (let i = 0; i < this.playlist.length; i++) {
      fileNames.push(this.playlist[i].title);
    }
    return fileNames;
  }

  decodeURI(uri: string): string {
    return decodeURI(uri);
  }

  downloadContent(): void {
    if (!this.db_playlist || this.downloading || this.download_request) return;
    const requestedPlaylistId = this.playlist_id;
    const zipName = this.db_playlist.name;
    const requestedUuid = this.uuid;
    const requestGeneration = this.request_generation;
    this.downloading = true;
    const request = this.postsService.downloadPlaylistFromServer(requestedPlaylistId, requestedUuid).subscribe({
      next: res => {
        if (requestGeneration !== this.request_generation || requestedPlaylistId !== this.playlist_id) return;
        try {
          this.savePlaylistArchive(res as Blob, zipName);
          this.postsService.openSnackBar($localize`:@@playlist-download-success:Playlist download started.`);
        } catch (_) {
          this.showPlaylistDownloadFailure();
        }
      },
      error: () => {
        if (requestGeneration === this.request_generation && requestedPlaylistId === this.playlist_id) {
          this.showPlaylistDownloadFailure();
        }
      }
    });
    this.download_request = request.closed ? null : request;
    request.add(() => {
      if (requestGeneration === this.request_generation) {
        this.downloading = false;
        this.finishDownloadRequest(requestGeneration);
      }
    });
  }

  downloadFile(): void {
    if (!this.playlist[0] || !this.uid || this.downloading || this.download_request) return;
    const requestedUid = this.uid;
    const requestedUuid = this.uuid;
    const filename = this.playlist[0].title;
    const ext = (this.playlist[0].type === 'audio/mp3') ? '.mp3' : '.mp4';
    const requestGeneration = this.request_generation;
    this.downloading = true;
    const request = this.postsService.downloadFileFromServer(requestedUid, requestedUuid).subscribe({
      next: res => {
        if (requestGeneration !== this.request_generation || requestedUid !== this.uid) return;
        try {
          this.saveMediaFile(res as Blob, filename + ext);
          this.postsService.openSnackBar($localize`:@@file-download-success:File download started.`);
        } catch (_) {
          this.showFileDownloadFailure();
        }
      },
      error: () => {
        if (requestGeneration === this.request_generation && requestedUid === this.uid) {
          this.showFileDownloadFailure();
        }
      }
    });
    this.download_request = request.closed ? null : request;
    request.add(() => {
      if (requestGeneration === this.request_generation) {
        this.downloading = false;
        this.finishDownloadRequest(requestGeneration);
      }
    });
  }

  savePlaylistArchive(blob: Blob, playlistName: string): void {
    saveAs(blob, playlistName + '.zip');
  }

  saveMediaFile(blob: Blob, filename: string): void {
    saveAs(blob, filename);
  }

  private showPlaylistDownloadFailure(): void {
    this.postsService.openSnackBar(
      $localize`:@@playlist-download-failed:Could not download playlist. Try again.`,
      $localize`Dismiss`
    );
  }

  private showFileDownloadFailure(): void {
    this.postsService.openSnackBar(
      $localize`:@@file-download-failed:Could not download file. Try again.`,
      $localize`Dismiss`
    );
  }

  playlistPostCreationHandler(playlistID: string): void {
    // changes the route without moving from the current view or
    // triggering a navigation event
    this.playlist_id = playlistID;
    this.router.navigateByUrl(this.router.url + ';id=' + playlistID);
  }

  drop(event: CdkDragDrop<string[]>): void {
    moveItemInArray(this.playlist, event.previousIndex, event.currentIndex);
  }

   playlistChanged(): boolean {
    return JSON.stringify(this.playlist) !== this.original_playlist;
  }

  openShareDialog(): void {
    const dialogRef = this.dialog.open(ShareMediaDialogComponent, {
      data: {
        uid: this.playlist_id ? this.playlist_id : this.uid,
        sharing_enabled: this.playlist_id ? this.db_playlist.sharingEnabled : this.db_file.sharingEnabled,
        is_playlist: !!this.playlist_id,
        uuid: this.postsService.isLoggedIn ? this.postsService.user.uid : this.uuid,
        current_timestamp: this.api.time.current
      },
      width: '60vw'
    });

    dialogRef.afterClosed().subscribe(() => {
      if (!this.playlist_id) {
        this.getFile();
      } else {
        this.getPlaylistFiles();
      }
    });
  }
  
  openFileInfoDialog(): void {
    let file_obj = this.db_file;
    const original_uid = this.currentItem.uid;
    if (this.db_playlist) {
      const idx = this.getPlaylistFileIndexUID(original_uid);
      file_obj = this.file_objs[idx];
    }
    const dialogRef = this.dialog.open(VideoInfoDialogComponent, {
      data: {
        file: file_obj,
      },
      minWidth: '50vw'
    });

    dialogRef.afterClosed().subscribe(() => {
      if (this.db_file) this.db_file = dialogRef.componentInstance.file;
      else if (this.db_playlist) {
        const idx = this.getPlaylistFileIndexUID(original_uid);
        this.file_objs[idx] = dialogRef.componentInstance.file;
      } 
    });
  }

  getPlaylistFileIndexUID(uid: string): number {
    return this.file_objs.findIndex(file_obj => file_obj['uid'] === uid);
  }

  setPlaybackTimestamp(time: number): void {
    this.api.seekTime(time);
  }

  togglePlayback(to_play: boolean): void {
    if (to_play) {
      this.api.play();
    } else {
      this.api.pause();
    }
  }

  setPlaybackRate(speed: number): void {
    this.api.playbackRate = speed;
  }

  finishDataRequest(requestGeneration: number): void {
    if (requestGeneration === this.request_generation) this.data_request = null;
  }

  finishDownloadRequest(requestGeneration: number): void {
    if (requestGeneration === this.request_generation) this.download_request = null;
  }

  stopMediaTracking(): void {
    if (this.save_volume_timer) clearInterval(this.save_volume_timer);
    this.save_volume_timer = null;
    this.loaded_metadata_subscription?.unsubscribe();
    this.ended_subscription?.unsubscribe();
    this.loaded_metadata_subscription = null;
    this.ended_subscription = null;
  }

  resetRouteState(): void {
    this.request_generation += 1;
    this.data_request?.unsubscribe();
    this.view_count_request?.unsubscribe();
    this.download_request?.unsubscribe();
    this.data_request = null;
    this.view_count_request = null;
    this.download_request = null;
    this.stopMediaTracking();
    this.playlist = [];
    this.original_playlist = null;
    this.currentIndex = 0;
    this.currentItem = null;
    this.api = null;
    this.api_ready = false;
    this.show_player = false;
    this.uids = [];
    this.type = null;
    this.file_objs = [];
    this.subscription = null;
    this.subPlaylist = null;
    this.db_playlist = null;
    this.db_file = null;
    this.downloading = false;
  }

  shuffleArray(array: unknown[]): void {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
