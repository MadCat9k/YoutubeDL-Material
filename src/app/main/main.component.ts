import { Component, OnDestroy, OnInit, ElementRef, ViewChild, ViewChildren, QueryList } from '@angular/core';
import {PostsService} from '../posts.services';
import { Observable, Subject, Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import {UntypedFormControl, Validators} from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { saveAs } from 'file-saver';
import { YoutubeSearchService, Result } from '../youtube-search.service';
import { Router, ActivatedRoute } from '@angular/router';
import { Platform } from '@angular/cdk/platform';
import { ArgModifierDialogComponent } from 'app/dialogs/arg-modifier-dialog/arg-modifier-dialog.component';
import { RecentVideosComponent } from 'app/components/recent-videos/recent-videos.component';
import { DatabaseFile, Download, FileType, Playlist } from 'api-types';

@Component({
  selector: 'app-root',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})
export class MainComponent implements OnInit, OnDestroy {
  youtubeAuthDisabledOverride = false;

  mainActionLabels = {
    customArgs: $localize`:Custom args action@@mainCustomArgsAction:Custom arguments`
  };

  readonly mainInputLabels = {
    url: $localize`:|URL:URL`,
    search: $localize`:|Search:Search`
  };

  iOS = false;

  // local settings
  determinateProgress = false;
  downloadingfile = false;
  audioOnly: boolean;
  autoplay = false;
  customArgsEnabled = false;
  customArgs = null;
  customOutputEnabled = false;
  replaceArgs = false;
  customOutput = null;
  youtubeAuthEnabled = false;
  youtubeUsername = null;
  youtubePassword = null;
  cropFile = false;
  cropFileStart = null;
  cropFileEnd = null;
  urlError = false;
  path: string | string[] = '';
  url = '';
  exists = '';
  percentDownloaded: number;
  autoStartDownload = false;

  // global settings
  fileManagerEnabled = false;
  allowQualitySelect = false;
  downloadOnlyMode = false;
  forceAutoplay = false;
  globalCustomArgs = null;
  allowAdvancedDownload = false;
  useDefaultDownloadingAgent = true;
  customDownloadingAgent = null;

  // cache
  cachedAvailableFormats = {};
  cachedFileManagerEnabled = localStorage.getItem('cached_filemanager_enabled') === 'true';

  // youtube api
  youtubeSearchEnabled = false;
  youtubeAPIKey = null;
  results_loading = false;
  results_showing = true;
  results = [];
  search_failed = false;
  last_search_query = '';

  playlists = {'audio': [], 'video': []};
  playlist_thumbnails = {};
  downloads: Download[] = [];
  download_uids: string[] = [];
  current_download: Download = null;

  urlForm = new UntypedFormControl('', [Validators.required]);

  qualityOptions = {
    'video': [
      {
        'resolution': '3840x2160',
        'value': '2160',
        'label': '2160p (4K)'
      },
      {
        'resolution': '2560x1440',
        'value': '1440',
        'label': '1440p'
      },
      {
        'resolution': '1920x1080',
        'value': '1080',
        'label': '1080p'
      },
      {
        'resolution': '1280x720',
        'value': '720',
        'label': '720p'
      },
      {
        'resolution': '720x480',
        'value': '480',
        'label': '480p'
      },
      {
        'resolution': '480x360',
        'value': '360',
        'label': '360p'
      },
      {
        'resolution': '360x240',
        'value': '240',
        'label': '240p'
      },
      {
        'resolution': '256x144',
        'value': '144',
        'label': '144p'
      }
    ],
    'audio': [
      // TODO: implement
      // {
      //   'kbitrate': '256',
      //   'value': '256K',
      //   'label': '256 Kbps'
      // },
      // {
      //   'kbitrate': '160',
      //   'value': '160K',
      //   'label': '160 Kbps'
      // },
      // {
      //   'kbitrate': '128',
      //   'value': '128K',
      //   'label': '128 Kbps'
      // },
      // {
      //   'kbitrate': '96',
      //   'value': '96K',
      //   'label': '96 Kbps'
      // },
      // {
      //   'kbitrate': '70',
      //   'value': '70K',
      //   'label': '70 Kbps'
      // },
      // {
      //   'kbitrate': '50',
      //   'value': '50K',
      //   'label': '50 Kbps'
      // },
      // {
      //   'kbitrate': '32',
      //   'value': '32K',
      //   'label': '32 Kbps'
      // }
    ]
  }

  selectedMaxQuality = '';
  selectedQuality: string | unknown = '';
  formats_loading = false;

  @ViewChild('urlinput', { read: ElementRef }) urlInput: ElementRef;
  @ViewChild('recentVideos') recentVideos: RecentVideosComponent;
  last_valid_url = '';
  last_url_check = 0;

  argsChangedSubject: Subject<boolean> = new Subject<boolean>();
  simulatedOutput = '';

  interval_id = null;
  initialization_subscription: Subscription = null;
  config_reloaded_subscription: Subscription = null;
  args_changed_subscription: Subscription = null;
  current_download_request: Subscription = null;
  search_input_subscription: Subscription = null;
  search_request: Subscription = null;
  format_requests = new Map<string, Subscription>();
  format_request_urls = new Set<string>();
  export_requests = new Map<string, Subscription>();
  export_cleanup_requests = new Set<Subscription>();
  polling_stopped = false;
  current_download_request_in_flight = false;
  currentDownloadConnectionError = false;
  consecutivePollFailures = 0;
  readonly currentDownloadCheckInterval = 1000;

  constructor(public postsService: PostsService, private youtubeSearch: YoutubeSearchService, public snackBar: MatSnackBar,
    private router: Router, public dialog: MatDialog, private platform: Platform, private route: ActivatedRoute) {
    this.audioOnly = false;
  }

  async configLoad(): Promise<void> {
    await this.loadConfig();
    if (this.autoStartDownload) {
      this.downloadClicked();
    }
  }

  async loadConfig(): Promise<boolean> {
    // loading config
    this.fileManagerEnabled = this.postsService.config['Extra']['file_manager_enabled']
                              && this.postsService.hasPermission('filemanager');
    this.downloadOnlyMode = this.postsService.config['Extra']['download_only_mode'];
    this.forceAutoplay = this.postsService.config['Extra']['force_autoplay'];
    this.globalCustomArgs = this.postsService.config['Downloader']['custom_args'];
    this.youtubeSearchEnabled = this.postsService.config['API'] && this.postsService.config['API']['use_youtube_API'] &&
        this.postsService.config['API']['youtube_API_key'];
    this.youtubeAPIKey = this.youtubeSearchEnabled ? this.postsService.config['API']['youtube_API_key'] : null;
    this.allowQualitySelect = this.postsService.config['Extra']['allow_quality_select'];
    this.allowAdvancedDownload = this.postsService.config['Advanced']['allow_advanced_download']
                                  && this.postsService.hasPermission('advanced_download');
    this.useDefaultDownloadingAgent = this.postsService.config['Advanced']['use_default_downloading_agent'];
    this.customDownloadingAgent = this.postsService.config['Advanced']['custom_downloading_agent'];

    // set final cache items

    localStorage.setItem('cached_filemanager_enabled', this.fileManagerEnabled.toString());
    this.cachedFileManagerEnabled = this.fileManagerEnabled;

    if (this.allowAdvancedDownload) {
      if (localStorage.getItem('customArgsEnabled') !== null) {
        this.customArgsEnabled = localStorage.getItem('customArgsEnabled') === 'true';
      }

      if (localStorage.getItem('customOutputEnabled') !== null) {
        this.customOutputEnabled = localStorage.getItem('customOutputEnabled') === 'true';
      }

      if (localStorage.getItem('replaceArgs') !== null) {
        this.replaceArgs = localStorage.getItem('replaceArgs') === 'true';
      }

      if (localStorage.getItem('youtubeAuthEnabled') !== null) {
        this.youtubeAuthEnabled = localStorage.getItem('youtubeAuthEnabled') === 'true';
      }

      // set advanced inputs
      const customArgs = localStorage.getItem('customArgs');
      const customOutput = localStorage.getItem('customOutput');
      const youtubeUsername = localStorage.getItem('youtubeUsername');

      if (customArgs && customArgs !== 'null') { this.customArgs = customArgs }
      if (customOutput && customOutput !== 'null') { this.customOutput = customOutput }
      if (youtubeUsername && youtubeUsername !== 'null') { this.youtubeUsername = youtubeUsername }

      this.getSimulatedOutput();
    }

    // get downloads routine
    this.startCurrentDownloadPolling();

    return true;
  }

  // app initialization.
  ngOnInit(): void {
    if (this.postsService.initialized) {
      this.configLoad();
    } else {
      this.initialization_subscription = this.postsService.service_initialized.subscribe(init => {
        if (init) {
          this.initialization_subscription?.unsubscribe();
          this.initialization_subscription = null;
          this.configLoad();
        }
      });
    }

    this.config_reloaded_subscription = this.postsService.config_reloaded.subscribe(changed => {
      if (changed) {
        this.loadConfig();
      }
    });

    this.iOS = this.platform.IOS;

    // get checkboxes
    if (localStorage.getItem('audioOnly') !== null) {
      this.audioOnly = localStorage.getItem('audioOnly') === 'true';
    }

    this.autoplay = this.forceAutoplay;
    if (!this.forceAutoplay && localStorage.getItem('autoplay') !== null) {
      this.autoplay = localStorage.getItem('autoplay') === 'true';
    }

    // check if params exist
    if (this.route.snapshot.paramMap.get('url')) {
      this.url = decodeURIComponent(this.route.snapshot.paramMap.get('url'));
      this.audioOnly = this.route.snapshot.paramMap.get('audioOnly') === 'true';

      // set auto start flag to true
      this.autoStartDownload = true;
    }

    this.args_changed_subscription = this.argsChangedSubject
      .debounceTime(500)
      .subscribe((should_simulate) => {
        if (should_simulate) this.getSimulatedOutput();
    });
  }

  ngAfterViewInit(): void {
    if (this.youtubeSearchEnabled && this.youtubeAPIKey) {
      this.youtubeSearch.initializeAPI(this.youtubeAPIKey);
      this.attachToInput();
    }
  }

  ngOnDestroy(): void {
    this.polling_stopped = true;
    this.initialization_subscription?.unsubscribe();
    this.config_reloaded_subscription?.unsubscribe();
    this.args_changed_subscription?.unsubscribe();
    this.current_download_request?.unsubscribe();
    this.search_input_subscription?.unsubscribe();
    this.search_request?.unsubscribe();
    this.format_requests.forEach(request => request.unsubscribe());
    this.export_requests.forEach(request => request.unsubscribe());
    this.export_cleanup_requests.forEach(request => request.unsubscribe());
    this.format_requests.clear();
    this.format_request_urls.clear();
    this.export_requests.clear();
    this.export_cleanup_requests.clear();
    this.current_download_request = null;
    this.search_input_subscription = null;
    this.search_request = null;
    this.current_download_request_in_flight = false;
    if (this.interval_id) { clearTimeout(this.interval_id) }
  }

  // download helpers
  downloadHelper(container: DatabaseFile | Playlist, type: string, is_playlist = false, force_view = false, navigate_mode = false): void {
    this.downloadingfile = false;
    if (!this.autoplay && !this.downloadOnlyMode && !navigate_mode) {
      // do nothing
      this.reloadRecentVideos(is_playlist);
    } else {
      // if download only mode, just download the file. no redirect
      if (force_view === false && this.downloadOnlyMode && !this.iOS) {
        if (is_playlist) {
          this.downloadPlaylist(container as Playlist);
        } else {
          this.downloadFileFromServer(container as DatabaseFile, type);
        }
        this.reloadRecentVideos(is_playlist);
      } else {
        localStorage.setItem('player_navigator', this.router.url.split(';')[0]);
        if (is_playlist) {
          this.router.navigate(['/player', {playlist_id: container['id'], type: type}]);
        } else {
          this.router.navigate(['/player', {type: type, uid: container['uid']}]);
        }
      }
    }
  }

  // download click handler
  downloadClicked(): void {
    if (!this.ValidURL(this.url)) {
      this.urlError = true;
      return;
    }

    this.urlError = false;

    // get common args
    const customArgs = (this.customArgsEnabled && this.replaceArgs ? this.customArgs : null);
    const additionalArgs = (this.customArgsEnabled && !this.replaceArgs ? this.customArgs : null);
    const customOutput = (this.customOutputEnabled ? this.customOutput : null);
    const youtubeUsername = (this.youtubeAuthEnabled && this.youtubeUsername ? this.youtubeUsername : null);
    const youtubePassword = (this.youtubeAuthEnabled && this.youtubePassword ? this.youtubePassword : null);

    // set advanced inputs
    if (this.allowAdvancedDownload) {
      if (customArgs) {
        localStorage.setItem('customArgs', customArgs);
      }
      if (customOutput) {
        localStorage.setItem('customOutput', customOutput);
      }
      if (youtubeUsername) {
        localStorage.setItem('youtubeUsername', youtubeUsername);
      }
    }

    const type = this.audioOnly ? 'audio' : 'video';

    const customQualityConfiguration = type === 'audio' ? this.getSelectedAudioFormat() : this.getSelectedVideoFormat();

    let cropFileSettings = null;

    if (this.cropFile) {
      cropFileSettings = {
        cropFileStart: this.cropFileStart,
        cropFileEnd: this.cropFileEnd
      }
    }

    const selected_quality = this.selectedQuality;
    this.selectedQuality = '';
    this.downloadingfile = true;

    const urls = this.getURLArray(this.url);
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      this.postsService.downloadFile(url, type as FileType, (customQualityConfiguration || selected_quality === '' || typeof selected_quality !== 'string' ? null : selected_quality),
        customQualityConfiguration, customArgs, additionalArgs, customOutput, youtubeUsername, youtubePassword, cropFileSettings).subscribe(res => {
          this.current_download = res['download'];
          this.downloads.push(res['download']);
          this.download_uids.push(res['download']['uid']);
      }, () => { // can't access server
        this.downloadingfile = false;
        this.current_download = null;
        this.postsService.openSnackBar($localize`Download failed!`, 'OK.');
      });

      if (!this.autoplay && urls.length === 1) {
          const download_queued_message = $localize`Download for ${url}:url: has been queued!`;
          this.postsService.openSnackBar(download_queued_message);
          this.url = '';
          this.downloadingfile = false;
      }
    }
  }

  // download canceled handler
  cancelDownload(download_to_cancel = null): void {
    // if one is provided, cancel that one. otherwise, remove the current one
    if (download_to_cancel) {
      this.removeDownloadFromCurrentDownloads(download_to_cancel)
      return;
    }
    this.downloadingfile = false;
    this.current_download = null;
    this.currentDownloadConnectionError = false;
    this.consecutivePollFailures = 0;
  }

  getSelectedAudioFormat(): string {
    if (typeof this.selectedQuality === 'string') { return null; }
    const cachedFormatsExists = this.cachedAvailableFormats[this.url] && this.cachedAvailableFormats[this.url]['formats'];
    if (cachedFormatsExists) {
      return this.selectedQuality['format_id'];
    } else {
      return null;
    }
  }

  getSelectedVideoFormat(): string {
    if (typeof this.selectedQuality === 'string') { return null; }
    const cachedFormats = this.cachedAvailableFormats[this.url] && this.cachedAvailableFormats[this.url]['formats'];
    if (cachedFormats) {
      if (this.selectedQuality) {
        let selected_video_format = this.selectedQuality['format_id'];
        // add in audio format if necessary
        const audio_missing = !this.selectedQuality['acodec'] || this.selectedQuality['acodec'] === 'none';
        if (audio_missing && cachedFormats['best_audio_format']) selected_video_format += `+${cachedFormats['best_audio_format']}`;
        return selected_video_format;
      }
    }
    return null;
  }

  getDownloadByUID(uid: string): Download {
    const index = this.downloads.findIndex(download => download.uid === uid);
    if (index !== -1) {
      return this.downloads[index];
    } else {
      return null;
    }
  }

  removeDownloadFromCurrentDownloads(download_to_remove: Download): boolean {
    if (this.current_download === download_to_remove) {
      this.current_download = null;
    }
    const index = this.downloads.indexOf(download_to_remove);
    if (index !== -1) {
      this.downloads.splice(index, 1);
      return true;
    } else {
      return false;
    }
  }

  downloadFileFromServer(file: DatabaseFile, type: string): void {
    if (!file?.uid) return;
    const requestKey = `file:${file.uid}`;
    if (this.export_requests.has(requestKey)) return;

    const requestedUid = file.uid;
    const ext = type === 'audio' ? 'mp3' : 'mp4';
    let filename: string;
    try {
      filename = decodeURIComponent(file.id) + `.${ext}`;
    } catch (_) {
      this.showFileExportFailure();
      return;
    }

    const request = this.postsService.downloadFileFromServer(requestedUid).subscribe({
      next: res => {
        try {
          this.saveExportedFile(res as Blob, filename);
          this.postsService.openSnackBar($localize`:@@file-download-success:File download started.`);
        } catch (_) {
          this.showFileExportFailure();
          return;
        }

        if (!this.fileManagerEnabled) {
          this.removeExportedServerFile(requestedUid);
        }
      },
      error: () => this.showFileExportFailure()
    });
    if (!request.closed) {
      this.export_requests.set(requestKey, request);
      request.add(() => this.export_requests.delete(requestKey));
    }
  }

  saveExportedFile(blob: Blob, filename: string): void {
    saveAs(blob, filename);
  }

  private removeExportedServerFile(uid: string): void {
    const cleanupRequest = this.postsService.deleteFile(uid).subscribe({
      next: removed => {
        if (!removed) this.showFileCleanupFailure();
      },
      error: () => this.showFileCleanupFailure()
    });
    if (!cleanupRequest.closed) {
      this.export_cleanup_requests.add(cleanupRequest);
      cleanupRequest.add(() => this.export_cleanup_requests.delete(cleanupRequest));
    }
  }

  private showFileCleanupFailure(): void {
    this.postsService.openSnackBar(
      $localize`:@@file-download-cleanup-failed:File downloaded, but the server copy could not be removed.`,
      $localize`Dismiss`
    );
  }

  private showFileExportFailure(): void {
    this.postsService.openSnackBar(
      $localize`:@@file-download-failed:Could not download file. Try again.`,
      $localize`Dismiss`
    );
  }

  downloadPlaylist(playlist: Playlist): void {
    if (!playlist?.id) return;
    const requestKey = `playlist:${playlist.id}`;
    if (this.export_requests.has(requestKey)) return;

    const requestedId = playlist.id;
    const requestedName = playlist.name;
    const request = this.postsService.downloadPlaylistFromServer(requestedId).subscribe({
      next: res => {
        try {
          this.saveExportedPlaylist(res as Blob, requestedName);
          this.postsService.openSnackBar($localize`:@@playlist-download-success:Playlist download started.`);
        } catch (_) {
          this.showPlaylistExportFailure();
        }
      },
      error: () => this.showPlaylistExportFailure()
    });
    if (!request.closed) {
      this.export_requests.set(requestKey, request);
      request.add(() => this.export_requests.delete(requestKey));
    }
  }

  saveExportedPlaylist(blob: Blob, playlistName: string): void {
    saveAs(blob, playlistName + '.zip');
  }

  private showPlaylistExportFailure(): void {
    this.postsService.openSnackBar(
      $localize`:@@playlist-download-failed:Could not download playlist. Try again.`,
      $localize`Dismiss`
    );
  }

  clearInput(): void {
    this.url = '';
    this.results_showing = false;
  }

  onInputBlur(): void {
    this.results_showing = false;
  }

  visitURL(url: string): void {
    window.open(url);
  }

  useURL(url: string): void {
    this.results_showing = false;
    this.url = url;
  }

  inputChanged(new_val: string): void {
    this.selectedQuality = '';
    if (new_val !== this.last_search_query) {
      this.search_request?.unsubscribe();
      this.search_request = null;
      this.search_failed = false;
      this.results_loading = false;
      this.results_showing = false;
    }
    if (new_val === '' || !new_val) {
      this.last_search_query = '';
    } else {
      if (this.ValidURL(new_val)) {
        this.last_search_query = '';
      }
    }
  }

  // checks if url is a valid URL
  ValidURL(str: string): boolean {
    // mark multiple urls as valid but don't get additional info
    const urls = this.getURLArray(str);
    if (urls.length > 1) {
      this.autoplay = false;
      return true;
    }
    
    // tslint:disable-next-line: max-line-length
    const strRegex = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)/;
    const re = new RegExp(strRegex);
    const valid = re.test(str);

    if (!valid) { return false; }

    // tslint:disable-next-line: max-line-length
    const youtubeStrRegex = /(?:http(?:s)?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:(?:watch)?\?(?:.*&)?v(?:i)?=|(?:embed|v|vi|user)\/))([^\?&\"'<> #]+)/;
    const reYT = new RegExp(youtubeStrRegex);
    const ytValid = true || reYT.test(str);
    if (valid && ytValid && Date.now() - this.last_url_check > 1000) {
      if (str !== this.last_valid_url && this.allowQualitySelect) {
        // get info
        this.getURLInfo(str);
        this.argsChanged();
      }
      this.last_valid_url = str;
    }
    return valid;
  }

  getURLInfo(url: string, forceRefresh = false): void {
    if (!this.cachedAvailableFormats[url]) {
      this.cachedAvailableFormats[url] = {};
    }
    // if url is a youtube playlist, skip getting url info
    if (url.includes('playlist')) {
      // make it think that formats errored so that users have options
      this.cachedAvailableFormats[url]['formats_loading'] = false;
      this.cachedAvailableFormats[url]['formats_failed'] = true;
      this.cachedAvailableFormats[url]['formats_request_failed'] = false;
      return;
    }

    if (this.format_request_urls.has(url)) return;
    if (!forceRefresh && this.cachedAvailableFormats[url]['formats']) return;

    if (forceRefresh) {
      delete this.cachedAvailableFormats[url]['formats'];
    }
    this.cachedAvailableFormats[url]['formats_loading'] = true;
    this.cachedAvailableFormats[url]['formats_failed'] = false;
    this.cachedAvailableFormats[url]['formats_request_failed'] = false;
    this.format_request_urls.add(url);

    const request = this.postsService.getFileFormats(url)
      .pipe(finalize(() => {
        this.format_request_urls.delete(url);
        this.format_requests.delete(url);
      }))
      .subscribe(res => {
        this.cachedAvailableFormats[url]['formats_loading'] = false;
        const infos = res['result'];
        if (!infos || !infos.formats) {
          this.errorFormats(url);
          return;
        }
        this.cachedAvailableFormats[url]['formats'] = this.getAudioAndVideoFormats(infos.formats);
      }, () => {
        this.errorFormats(url);
      });

    if (!request.closed) {
      this.format_requests.set(url, request);
    }
  }

  retryFormats(url: string): void {
    if (!url || this.format_request_urls.has(url)) return;
    this.getURLInfo(url, true);
  }

  getSimulatedOutput(): void {
    const urls = this.getURLArray(this.url);
    if (urls.length > 1) return;

    // this function should be very similar to downloadClicked()
    const customArgs = (this.customArgsEnabled && this.replaceArgs ? this.customArgs : null);
    const additionalArgs = (this.customArgsEnabled && !this.replaceArgs ? this.customArgs : null);
    const customOutput = (this.customOutputEnabled ? this.customOutput : null);
    const youtubeUsername = (this.youtubeAuthEnabled && this.youtubeUsername ? this.youtubeUsername : null);
    const youtubePassword = (this.youtubeAuthEnabled && this.youtubePassword ? this.youtubePassword : null);

    const type = this.audioOnly ? 'audio' : 'video';

    const customQualityConfiguration = type === 'audio' ? this.getSelectedAudioFormat() : this.getSelectedVideoFormat();

    let cropFileSettings = null;

    if (this.cropFile) {
      cropFileSettings = {
        cropFileStart: this.cropFileStart,
        cropFileEnd: this.cropFileEnd
      }
    }

    this.postsService.generateArgs(this.url, type as FileType, (customQualityConfiguration || this.selectedQuality === '' || typeof this.selectedQuality !== 'string' ? null : this.selectedQuality),
      customQualityConfiguration, customArgs, additionalArgs, customOutput, youtubeUsername, youtubePassword, cropFileSettings).subscribe(res => {
        const simulated_args = res['args'];
        if (simulated_args) {
          // hide password if needed
          const passwordIndex = simulated_args.indexOf('--password');
          if (passwordIndex !== -1 && passwordIndex !== simulated_args.length - 1) {
            simulated_args[passwordIndex + 1] = simulated_args[passwordIndex + 1].replace(/./g, '*');
          }
          const downloader = this.postsService.config.Advanced.default_downloader;
          this.simulatedOutput = `${downloader} ${this.url} ${simulated_args.join(' ')}`;
        }
    });
  }

  errorFormats(url: string): void {
    this.cachedAvailableFormats[url]['formats_loading'] = false;
    this.cachedAvailableFormats[url]['formats_failed'] = true;
    this.cachedAvailableFormats[url]['formats_request_failed'] = true;
  }

  attachToInput(): void {
    this.search_input_subscription?.unsubscribe();
    this.search_input_subscription = Observable.fromEvent(this.urlInput.nativeElement, 'input')
      .map((e: any) => e.target.value)           // extract the value of input
      .filter((text: string) => text.length > 1) // filter out if empty
      .debounceTime(250)                         // only once every 250ms
      .subscribe((query: string) => this.searchVideos(query));
  }

  searchVideos(query: string): void {
    this.search_request?.unsubscribe();
    this.search_request = null;
    this.search_failed = false;
    this.results_showing = false;

    if (!query || this.youtubeSearch.ValidURL(query)) {
      this.last_search_query = '';
      this.results_loading = false;
      return;
    }

    this.last_search_query = query;
    this.results_loading = true;
    let request: Subscription = null;
    request = this.youtubeSearch.search(query)
      .pipe(finalize(() => {
        if (this.search_request === request) {
          this.search_request = null;
        }
      }))
      .subscribe({
        next: (results: Result[]) => {
          this.results_loading = false;
          if (this.url !== '' && results && results.length > 0) {
            this.results = results;
            this.results_showing = true;
          }
        },
        error: () => {
          this.results_loading = false;
          this.results_showing = false;
          this.search_failed = true;
        }
      });

    if (!request.closed) {
      this.search_request = request;
    }
  }

  retrySearch(): void {
    if (!this.search_failed || !this.last_search_query) return;
    this.searchVideos(this.last_search_query);
  }

  argsChanged(): void {
    this.argsChangedSubject.next(true);
  }

  videoModeChanged(new_val): void {
    this.selectedQuality = '';
    localStorage.setItem('audioOnly', new_val.checked.toString());
    this.argsChanged();
  }

  autoplayChanged(new_val): void {
    localStorage.setItem('autoplay', new_val.checked.toString());
  }

  customArgsEnabledChanged(new_val): void {
    localStorage.setItem('customArgsEnabled', new_val.checked.toString());
    this.argsChanged();
  }

  replaceArgsChanged(new_val): void {
    localStorage.setItem('replaceArgs', new_val.checked.toString());
    this.argsChanged();
  }

  customOutputEnabledChanged(new_val): void {
    localStorage.setItem('customOutputEnabled', new_val.checked.toString());
    this.argsChanged();
  }

  youtubeAuthEnabledChanged(new_val): void {
    localStorage.setItem('youtubeAuthEnabled', new_val.checked.toString());
    this.argsChanged();
  }

  getAudioAndVideoFormats(formats): void {
    const audio_formats: any = {};
    const video_formats: any = {};

    for (let i = 0; i < formats.length; i++) {
      const format_obj = {type: null};

      const format = formats[i];
      const format_type = (format.vcodec === 'none') ? 'audio' : 'video';

      format_obj.type = format_type;
      if (format_obj.type === 'audio' && format.abr) {
        const key = format.abr.toString() + 'K';
        format_obj['key'] = key;
        format_obj['bitrate'] = format.abr;
        format_obj['format_id'] = format.format_id;
        format_obj['ext'] = format.ext;
        format_obj['label'] = key;
        format_obj['expected_filesize'] = format.filesize ? format.filesize : (format.filesize_approx || null);

        // don't overwrite if not m4a
        if (audio_formats[key]) {
          if (format.ext === 'm4a') {
            audio_formats[key] = format_obj;
          }
        } else {
          audio_formats[key] = format_obj;
        }
      } else if (format_obj.type === 'video') {
        // check if video format is mp4
        const key = `${format.height}p${Math.round(format.fps)}`;
        if (format.ext === 'mp4' || format.ext === 'mkv' || format.ext === 'webm') {
          format_obj['key'] = key;
          format_obj['height'] = format.height;
          format_obj['acodec'] = format.acodec;
          format_obj['format_id'] = format.format_id;
          format_obj['label'] = key;
          format_obj['fps'] = Math.round(format.fps);
          format_obj['expected_filesize'] = format.filesize ? format.filesize : (format.filesize_approx || null);

          // no acodec means no overwrite
          if (!(video_formats[key]) || format_obj['acodec'] !== 'none') {
            video_formats[key] = format_obj;
          }
        }
      }
    }

    const parsed_formats: any = {};

    parsed_formats['best_audio_format'] = this.getBestAudioFormatForMp4(audio_formats);

    // add audio file size to the expected video file size -- but only if best_audio_format will be used (i.e. when the video has no acodec already). if acodec is present expected filesize will include it
    for (const video_format of Object.values(video_formats)) {
      if ((!video_format['acodec'] || video_format['acodec'] === 'none')
        && video_format['expected_filesize']
        && parsed_formats['best_audio_format']?.filesize) 
          video_format['expected_filesize'] += parsed_formats['best_audio_format'].filesize;
    }

    parsed_formats['video'] = Object.values(video_formats);
    parsed_formats['audio'] = Object.values(audio_formats);

    parsed_formats['video'] = parsed_formats['video'].sort((a, b) => b.height - a.height || b.fps - a.fps);
    parsed_formats['audio'] = parsed_formats['audio'].sort((a, b) => b.bitrate - a.bitrate);

    return parsed_formats;
  }

  getBestAudioFormatForMp4(audio_formats): void {
    let best_audio_format_for_mp4 = null;
    let best_audio_format_bitrate = 0;
    const available_audio_format_keys = Object.keys(audio_formats);
    for (let i = 0; i < available_audio_format_keys.length; i++) {
      const audio_format_key = available_audio_format_keys[i];
      const audio_format = audio_formats[audio_format_key];
      const is_m4a = audio_format.ext === 'm4a';
      if (is_m4a && audio_format.bitrate > best_audio_format_bitrate) {
        best_audio_format_for_mp4 = audio_format.format_id;
        best_audio_format_bitrate = audio_format.bitrate;
      }
    }
    return best_audio_format_for_mp4;
  }

  // modify custom args
  openArgsModifierDialog(): void {
    const dialogRef = this.dialog.open(ArgModifierDialogComponent, {
      data: {
       initial_args: this.customArgs
      }
    });
    dialogRef.afterClosed().subscribe(new_args => {
      if (new_args !== null && new_args !== undefined) {
        this.customArgs = new_args;
      }
    });
  }

  startCurrentDownloadPolling(): void {
    this.polling_stopped = false;
    if (this.interval_id) clearTimeout(this.interval_id);
    this.pollCurrentDownload();
  }

  pollCurrentDownload(): void {
    if (this.polling_stopped) return;
    if (!this.current_download) {
      this.scheduleCurrentDownloadPoll();
      return;
    }
    this.getCurrentDownload(true);
  }

  getCurrentDownload(scheduleNextPoll = false): void {
    if (!this.current_download || this.current_download_request_in_flight) return;

    const requestedUid = this.current_download['uid'];
    this.current_download_request_in_flight = true;
    const request = this.postsService.getCurrentDownload(requestedUid).subscribe(res => {
      if (!this.current_download || this.current_download['uid'] !== requestedUid) return;
      if (res['download']) {
        this.currentDownloadConnectionError = false;
        this.consecutivePollFailures = 0;
        this.current_download = res['download'];
        this.percentDownloaded = this.current_download.percent_complete;

        if (this.current_download['finished'] && !this.current_download['error']) {
          const container = this.current_download['container'];
          const is_playlist = this.current_download['file_uids'].length > 1;
          const type = this.current_download['type'];
          this.current_download = null;  
          this.downloadHelper(container, type, is_playlist, false);
        } else if (this.current_download['finished'] && this.current_download['error']) {
          this.downloadingfile = false;
          this.current_download = null;
          this.postsService.openSnackBar($localize`Download failed!`, 'OK.');
        }
      } else {
        this.markCurrentDownloadRefreshFailed();
      }
    }, () => {
      if (this.current_download?.['uid'] === requestedUid) {
        this.markCurrentDownloadRefreshFailed();
      }
      this.finishCurrentDownloadRequest(scheduleNextPoll);
    }, () => {
      this.finishCurrentDownloadRequest(scheduleNextPoll);
    });
    this.current_download_request = request.closed ? null : request;
  }

  markCurrentDownloadRefreshFailed(): void {
    this.currentDownloadConnectionError = true;
    this.consecutivePollFailures += 1;
  }

  finishCurrentDownloadRequest(scheduleNextPoll: boolean): void {
    this.current_download_request = null;
    this.current_download_request_in_flight = false;
    if (scheduleNextPoll) this.scheduleCurrentDownloadPoll();
  }

  scheduleCurrentDownloadPoll(): void {
    if (this.polling_stopped) return;
    this.interval_id = setTimeout(() => this.pollCurrentDownload(), this.getNextPollDelay());
  }

  getNextPollDelay(): number {
    if (!this.currentDownloadConnectionError) return this.currentDownloadCheckInterval;
    const backoffMultiplier = Math.pow(2, Math.min(this.consecutivePollFailures, 5));
    return Math.min(this.currentDownloadCheckInterval * backoffMultiplier, 30000);
  }

  reloadRecentVideos(is_playlist = false): void {
    this.postsService.files_changed.next(true);
    if (is_playlist) this.postsService.playlists_changed.next(true);
  }

  getURLArray(url_str: string): Array<string> {
    let lines = url_str.split('\n');
    lines = lines.filter(line => line);
    return lines;
  }

    /**
   * Format bytes as human-readable text.
   * From: https://stackoverflow.com/questions/10420352/converting-file-size-in-bytes-to-human-readable-string
   * 
   * @param bytes Number of bytes.
   * @param si True to use metric (SI) units, aka powers of 1000. False to use 
   *           binary (IEC), aka powers of 1024.
   * @param dp Number of decimal places to display.
   * 
   * @return Formatted string.
   */
  humanFileSize(bytes: number, si=true, dp=1) {
    const thresh = si ? 1000 : 1024;

    if (Math.abs(bytes) < thresh) {
      return bytes + ' B';
    }

    const units = si 
      ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] 
      : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let u = -1;
    const r = 10**dp;

    do {
      bytes /= thresh;
      ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);


    return bytes.toFixed(dp) + ' ' + units[u];
  }
}
