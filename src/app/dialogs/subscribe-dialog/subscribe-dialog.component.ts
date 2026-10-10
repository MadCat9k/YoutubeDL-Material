import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialogRef, MatDialog } from '@angular/material/dialog';
import { PostsService } from 'app/posts.services';
import { Subscription } from 'rxjs';
import { ArgModifierDialogComponent } from '../arg-modifier-dialog/arg-modifier-dialog.component';

@Component({
  selector: 'app-subscribe-dialog',
  templateUrl: './subscribe-dialog.component.html',
  styleUrls: ['./subscribe-dialog.component.scss']
})
export class SubscribeDialogComponent implements OnInit, OnDestroy {
  // inputs
  timerange_amount;
  timerange_unit = 'days';
  download_all = true;
  url = null;
  name = null;

  maxQuality = 'best';

  // state
  subscribing = false;
  subscriptionError = '';
  subscriptionRequest: Subscription = null;

  // audio only mode
  audioOnlyMode = false;

  customFileOutput = '';
  customArgs = '';

  available_qualities = [
    {
      'label': 'Best',
      'value': 'best'
    },
    {
      'label': '4K',
      'value': '2160'
    },
    {
      'label': '1440p',
      'value': '1440'
    },
    {
      'label': '1080p',
      'value': '1080'
    },
    {
      'label': '720p',
      'value': '720'
    },
    {
      'label': '480p',
      'value': '480'
    },
    {
      'label': '360p',
      'value': '360'
    }
  ];

  time_units = [
    'day',
    'week',
    'month',
    'year'
  ];

  constructor(private postsService: PostsService,
              private dialog: MatDialog,
              public dialogRef: MatDialogRef<SubscribeDialogComponent>) { }

  ngOnInit() {
  }

  ngOnDestroy(): void {
    this.subscriptionRequest?.unsubscribe();
    this.subscriptionRequest = null;
  }

  subscribeClicked() {
    if (this.subscribing) return;
    if (this.url && this.url.trim() !== '') {
      // timerange must be specified if download_all is false
      if (!this.download_all && !this.timerange_amount) {
        this.postsService.openSnackBar($localize`You must specify an amount of time`);
        return;
      }
      this.subscribing = true;
      this.subscriptionError = '';

      let timerange = null;
      if (!this.download_all) {
        timerange = 'now-' + this.timerange_amount.toString() + this.timerange_unit;
      }
      const request = this.postsService.createSubscription(this.url.trim(), this.name, timerange, this.maxQuality,
                                          this.audioOnlyMode, this.customArgs, this.customFileOutput).subscribe(res => {
        this.subscribing = false;
        if (res['new_sub']) {
          this.dialogRef.close(res['new_sub']);
        } else {
          this.subscriptionError = this.getSubscriptionError(res['error']);
        }
      }, error => {
        this.subscribing = false;
        this.subscriptionError = this.getSubscriptionError(error?.error?.error);
        this.subscriptionRequest = null;
      }, () => {
        this.subscriptionRequest = null;
      });
      this.subscriptionRequest = request.closed ? null : request;
    }
  }

  getSubscriptionError(error: string): string {
    const knownErrors = [
      'A subscription with this URL already exists. Custom name is required.',
      'Subscription name must be a single non-empty folder name.',
      'Could not determine a valid subscription name. Please provide a custom name.',
      'Failed to prepare the subscription.'
    ];
    if (knownErrors.includes(error)) return error;
    return $localize`:Subscription creation fallback error@@subscription-create-failed:Could not create the subscription. Check the URL or custom name, then try again.`;
  }

  // modify custom args
  openArgsModifierDialog() {
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
}
