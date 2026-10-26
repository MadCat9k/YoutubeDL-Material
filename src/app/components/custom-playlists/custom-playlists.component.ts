import { Component, OnDestroy, OnInit } from '@angular/core';
import { PostsService } from 'app/posts.services';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { CreatePlaylistComponent } from 'app/create-playlist/create-playlist.component';
import { Playlist } from 'api-types';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-custom-playlists',
  templateUrl: './custom-playlists.component.html',
  styleUrls: ['./custom-playlists.component.scss']
})
export class CustomPlaylistsComponent implements OnInit, OnDestroy {

  readonly createPlaylistLabel = $localize`:|Create a playlist dialog title:Create a playlist`;

  playlists = null;
  playlists_received = false;
  downloading_content: {[playlistId: string]: boolean} = {};
  private readonly destroyed = new Subject<void>();

  constructor(public postsService: PostsService, private router: Router, private dialog: MatDialog) { }

  ngOnInit(): void {
    this.postsService.service_initialized.pipe(takeUntil(this.destroyed)).subscribe(init => {
      if (init) {
        this.getAllPlaylists();
      }
    });

    this.postsService.playlists_changed.pipe(takeUntil(this.destroyed)).subscribe(changed => {
      if (changed) {
        this.getAllPlaylists();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  getAllPlaylists(): void {
    this.playlists_received = false;
    // must call getAllFiles as we need to get category playlists as well
    this.postsService.getPlaylists(true).pipe(takeUntil(this.destroyed)).subscribe(res => {
      this.playlists = res['playlists'];
      this.playlists_received = true;
    });
  }

  // creating a playlist
  openCreatePlaylistDialog(): void {
    const dialogRef = this.dialog.open(CreatePlaylistComponent, {
      data: {
        create_mode: true
      },
      minWidth: '90vw',
      minHeight: '95vh'
    });
    dialogRef.afterClosed().pipe(takeUntil(this.destroyed)).subscribe(result => {
      if (result) {
        this.getAllPlaylists();
        this.postsService.openSnackBar($localize`Successfully created playlist!`);
      } else if (result === false) {
        this.postsService.openSnackBar($localize`ERROR: failed to create playlist!`);
      }
    });
  }

  goToPlaylist(info_obj: { file: Playlist; }): void {
    const playlist = info_obj.file;
    const playlistID = playlist.id;

    if (playlist) {
      if (this.postsService.config['Extra']['download_only_mode']) {
        this.downloadPlaylist(playlist.id, playlist.name);
      } else {
        localStorage.setItem('player_navigator', this.router.url);
        const routeParams = {playlist_id: playlistID};
        if (playlist.auto) { routeParams['auto'] =  playlist.auto; }
        this.router.navigate(['/player', routeParams]);
      }
    } else {
      // playlist not found
      // TODO: Make translatable
      console.error(`Playlist with ID ${playlistID} not found!`);
    }
  }

  downloadPlaylist(playlist_id: string, playlist_name: string): void {
    if (!playlist_id || this.downloading_content[playlist_id]) return;

    this.downloading_content[playlist_id] = true;
    this.postsService.downloadPlaylistFromServer(playlist_id).pipe(
      takeUntil(this.destroyed),
      finalize(() => delete this.downloading_content[playlist_id])
    ).subscribe({
      next: res => {
        try {
          this.savePlaylistArchive(res as Blob, playlist_name);
          this.postsService.openSnackBar($localize`:@@playlist-download-success:Playlist download started.`);
        } catch (_) {
          this.showPlaylistDownloadFailure();
        }
      },
      error: () => this.showPlaylistDownloadFailure()
    });
  }

  savePlaylistArchive(blob: Blob, playlistName: string): void {
    saveAs(blob, playlistName + '.zip');
  }

  private showPlaylistDownloadFailure(): void {
    this.postsService.openSnackBar(
      $localize`:@@playlist-download-failed:Could not download playlist. Try again.`,
      $localize`Dismiss`
    );
  }

  deletePlaylist(args: { file: Playlist; index: number; }): void {
    const playlist = args.file;
    const index = args.index;
    const playlistID = playlist.id;
    this.postsService.removePlaylist(playlistID).pipe(takeUntil(this.destroyed)).subscribe(res => {
      if (res['success']) {
        this.playlists.splice(index, 1);
        this.postsService.openSnackBar($localize`Playlist successfully removed.`);
      }
      this.getAllPlaylists();
    });
  }

  editPlaylistDialog(args: { playlist: Playlist; index: number; }): void {
    const playlist = args.playlist;
    const index = args.index;
    const dialogRef = this.dialog.open(CreatePlaylistComponent, {
      data: {
        playlist_id: playlist.id,
        create_mode: false
      },
      minWidth: '85vw'
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroyed)).subscribe(() => {
      // updates playlist in file manager if it changed
      if (dialogRef.componentInstance.playlist_updated) {
        this.playlists[index] = dialogRef.componentInstance.playlist;
      }
    });
  }

}
