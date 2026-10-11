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
          this.subscriptionError = this.getSubscriptionError(res['error_code'], res['error']);
        }
      }, error => {
        this.subscribing = false;
        this.subscriptionError = this.getSubscriptionError(error?.error?.error_code, error?.error?.error);
        this.subscriptionRequest = null;
      }, () => {
        this.subscriptionRequest = null;
      });
      this.subscriptionRequest = request.closed ? null : request;
    }
  }

  getSubscriptionError(errorCode: string, legacyError = ''): string {
    switch (errorCode) {
      case 'duplicate_subscription':
        return $localize`:Duplicate subscription creation error@@subscription-create-duplicate:A subscription with this URL already exists. Enter a custom name to create another.`;
      case 'invalid_subscription_name':
        return $localize`:Invalid subscription name error@@subscription-create-invalid-name:The custom name must be a single folder name.`;
      case 'subscription_metadata_unavailable':
        return $localize`:Subscription metadata unavailable error@@subscription-create-metadata-unavailable:Could not read subscription details. Check that the URL is supported and reachable, then try again.`;
      case 'subscription_preparation_failed':
        return $localize`:Subscription preparation error@@subscription-create-preparation-failed:Could not prepare the subscription. Try again.`;
    }
    const legacyErrors: {[key: string]: string} = {
      'A subscription with this URL already exists. Custom name is required.': 'duplicate_subscription',
      'Subscription name must be a single non-empty folder name.': 'invalid_subscription_name',
      'Could not determine a valid subscription name. Please provide a custom name.': 'subscription_metadata_unavailable',
      'Failed to prepare the subscription.': 'subscription_preparation_failed'
    };
    if (legacyErrors[legacyError]) return this.getSubscriptionError(legacyErrors[legacyError]);
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
