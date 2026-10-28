import { Component, OnDestroy, OnInit, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PostsService } from 'app/posts.services';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-share-media-dialog',
  templateUrl: './share-media-dialog.component.html',
  styleUrls: ['./share-media-dialog.component.scss']
})
export class ShareMediaDialogComponent implements OnInit, OnDestroy {

  uid = null;
  uuid = null;
  share_url = null;
  default_share_url = null;
  sharing_enabled = null;
  is_playlist = null;
  current_timestamp = null
  timestamp_enabled = false;
  sharingPending = false;
  sharingRequest: Subscription = null;

  constructor(@Inject(MAT_DIALOG_DATA) public data: any, public router: Router, private snackBar: MatSnackBar,
              public postsService: PostsService) { }

  ngOnInit(): void {
    if (this.data) {
      this.uid = this.data.uid;
      this.uuid = this.data.uuid;
      this.sharing_enabled = this.data.sharing_enabled;
      this.is_playlist = this.data.is_playlist;
      this.current_timestamp = (this.data.current_timestamp / 1000).toFixed(2);

      const arg = (this.is_playlist ? ';playlist_id=' : ';uid=');
      this.default_share_url = window.location.href.split(';')[0] + arg + this.uid;
      if (this.uuid) {
        this.default_share_url += ';uuid=' + this.uuid;
      }
      this.share_url = this.default_share_url;
    }
  }

  ngOnDestroy(): void {
    this.sharingRequest?.unsubscribe();
    this.sharingRequest = null;
    this.sharingPending = false;
  }

  timestampInputChanged(change) {
    if (!this.timestamp_enabled) {
      this.share_url = this.default_share_url;
      return;
    }
    const new_val = change.target.value;
    if (new_val > 0) {
      this.share_url = this.default_share_url + ';timestamp=' + new_val;
    } else {
      this.share_url = this.default_share_url;
    }
  }

  useTimestampChanged() {
    this.timestampInputChanged({target: {value: this.current_timestamp}})
  }

  copiedToClipboard() {
    this.postsService.openSnackBar($localize`Copied to clipboard!`);
  }

  sharingChanged(event) {
    if (this.sharingPending) {
      this.restoreSharingCheckbox(event);
      return;
    }

    const requestedState = Boolean(event.checked);
    const request$ = requestedState
      ? this.postsService.enableSharing(this.uid, this.is_playlist)
      : this.postsService.disableSharing(this.uid, this.is_playlist);

    this.sharingPending = true;
    let request: Subscription = null;
    request = request$.pipe(
      finalize(() => {
        if (this.sharingRequest === request) {
          this.sharingRequest = null;
          this.sharingPending = false;
        }
      })
    ).subscribe({
      next: res => {
        if (!res || !res['success']) {
          this.restoreSharingCheckbox(event);
          this.showSharingFailure(requestedState, false);
          return;
        }

        this.sharing_enabled = requestedState;
        if (event?.source) event.source.checked = requestedState;
        this.postsService.openSnackBar(requestedState ? $localize`Sharing enabled.` : $localize`Sharing disabled.`);
      },
      error: () => {
        this.restoreSharingCheckbox(event);
        this.showSharingFailure(requestedState, true);
      }
    });

    if (!request.closed) {
      this.sharingRequest = request;
    } else {
      this.sharingPending = false;
    }
  }

  private restoreSharingCheckbox(event): void {
    if (event?.source) event.source.checked = Boolean(this.sharing_enabled);
  }

  private showSharingFailure(requestedState: boolean, serverError: boolean): void {
    if (requestedState) {
      this.postsService.openSnackBar(serverError
        ? $localize`Failed to enable sharing - server error.`
        : $localize`Failed to enable sharing.`);
      return;
    }

    this.postsService.openSnackBar(serverError
      ? $localize`Failed to disable sharing - server error.`
      : $localize`Failed to disable sharing.`);
  }

  public openSnackBar(message: string, action: string = '') {
    this.snackBar.open(message, action, {
      duration: 2000,
    });
  }

}
