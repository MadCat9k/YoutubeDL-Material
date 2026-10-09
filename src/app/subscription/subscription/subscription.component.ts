import { Component, OnDestroy, OnInit } from '@angular/core';
import { PostsService } from 'app/posts.services';
import { ActivatedRoute, Router, ParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { EditSubscriptionDialogComponent } from 'app/dialogs/edit-subscription-dialog/edit-subscription-dialog.component';
import { Subscription } from 'api-types';
import { Subject, Subscription as RxSubscription } from 'rxjs';
import { distinctUntilChanged, filter, map, switchMap, take, takeUntil, tap } from 'rxjs/operators';

@Component({
  selector: 'app-subscription',
  templateUrl: './subscription.component.html',
  styleUrls: ['./subscription.component.scss']
})
export class SubscriptionComponent implements OnInit, OnDestroy {

  id = null;
  subscription: Subscription = null;
  use_youtubedl_archive = false;
  descendingMode = true;
  downloading = false;
  sub_interval = null;
  check_clicked = false;
  cancel_clicked = false;
  pollingStopped = true;
  subscriptionConnectionError = false;
  consecutivePollFailures = 0;
  readonly subscriptionCheckInterval = 1000;
  private destroy$ = new Subject<void>();
  private subscriptionRequest: RxSubscription = null;
  private requestGeneration = 0;

  constructor(private postsService: PostsService, private route: ActivatedRoute, private router: Router, private dialog: MatDialog) { }

  ngOnInit() {
    this.route.params.pipe(
      map(params => params['id']),
      distinctUntilChanged(),
      tap(id => {
        this.stopSubscriptionPolling();
        this.cancelSubscriptionRequest();
        this.requestGeneration++;
        this.id = id;
        this.subscription = null;
        this.subscriptionConnectionError = false;
        this.consecutivePollFailures = 0;
      }),
      switchMap(() => this.postsService.service_initialized.pipe(
        filter(init => init),
        take(1)
      )),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.getConfig();
      this.pollingStopped = false;
      this.getSubscription(false, true);
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopSubscriptionPolling();
    this.cancelSubscriptionRequest();
  }

  goBack() {
    this.router.navigate(['/subscriptions']);
  }

  getSubscription(low_cost = false, scheduleNextPoll = false) {
    if (low_cost && this.subscriptionRequest && !this.subscriptionRequest.closed) {
      return;
    }
    this.cancelSubscriptionRequest();
    const requestedId = this.id;
    const requestGeneration = ++this.requestGeneration;
    const request = this.postsService.getSubscription(requestedId).subscribe(res => {
      if (requestGeneration !== this.requestGeneration || requestedId !== this.id) {
        return;
      }
      if (!res?.['subscription'] || !Array.isArray(res['subscription']['videos'])) {
        this.markSubscriptionRefreshFailed();
        return;
      }
      this.subscriptionConnectionError = false;
      this.consecutivePollFailures = 0;
      if (low_cost && res['subscription'].videos.length === this.subscription?.videos.length) {
        if (res['subscription']['downloading'] !== this.subscription['downloading']) {
          this.subscription['downloading'] = res['subscription']['downloading'];
        }
        return;
      } else if (res['subscription']['videos'].length > (this.subscription?.videos.length || 0)) {
        // only when files are added so we don't reload files when one is deleted
        this.postsService.files_changed.next(true);
      }
      this.subscription = res['subscription'];
    }, () => {
      if (requestGeneration === this.requestGeneration && requestedId === this.id) {
        this.markSubscriptionRefreshFailed();
      }
    });
    this.subscriptionRequest = request.closed ? null : request;
    request.add(() => {
      if (this.subscriptionRequest === request) {
        this.subscriptionRequest = null;
      }
      if (scheduleNextPoll && !this.pollingStopped && requestGeneration === this.requestGeneration && requestedId === this.id) {
        this.sub_interval = window.setTimeout(
          () => this.getSubscription(true, true),
          this.getNextPollDelay()
        );
      }
    });
  }

  markSubscriptionRefreshFailed(): void {
    this.subscriptionConnectionError = true;
    this.consecutivePollFailures += 1;
  }

  getNextPollDelay(): number {
    if (!this.subscriptionConnectionError) return this.subscriptionCheckInterval;
    const backoffMultiplier = Math.pow(2, Math.min(this.consecutivePollFailures, 5));
    return Math.min(this.subscriptionCheckInterval * backoffMultiplier, 30000);
  }

  private stopSubscriptionPolling(): void {
    this.pollingStopped = true;
    if (this.sub_interval !== null) {
      window.clearTimeout(this.sub_interval);
      this.sub_interval = null;
    }
  }

  private cancelSubscriptionRequest(): void {
    this.subscriptionRequest?.unsubscribe();
    this.subscriptionRequest = null;
  }

  getConfig(): void {
    this.use_youtubedl_archive = this.postsService.config['Downloader']['use_youtubedl_archive'];
  }

  downloadContent(): void {
    this.downloading = true;
    this.postsService.downloadSubFromServer(this.subscription.id).subscribe(res => {
      this.downloading = false;
      const blob: Blob = res;
      saveAs(blob, this.subscription.name + '.zip');
    }, err => {
      console.log(err);
      this.downloading = false;
    });
  }

  editSubscription(): void {
    this.dialog.open(EditSubscriptionDialogComponent, {
      data: {
        sub: this.postsService.getSubscriptionByID(this.subscription.id)
      }
    });
  }

  watchSubscription(): void {
    this.router.navigate(['/player', {sub_id: this.subscription.id}])
  }

  checkSubscription(): void {
    this.check_clicked = true;
    this.postsService.checkSubscription(this.subscription.id).subscribe(res => {
      this.check_clicked = false;
      if (!res['success']) {
        this.postsService.openSnackBar('Failed to check subscription!');
        return;
      }
    }, err => {
      console.error(err);
      this.check_clicked = false;
      this.postsService.openSnackBar('Failed to check subscription!');
    });
  }

  cancelCheckSubscription(): void {
    this.cancel_clicked = true;
    this.postsService.cancelCheckSubscription(this.subscription.id).subscribe(res => {
      this.cancel_clicked = false;
      if (!res['success']) {
        this.postsService.openSnackBar('Failed to cancel check subscription!');
        return;
      }
    }, err => {
      console.error(err);
      this.cancel_clicked = false;
      this.postsService.openSnackBar('Failed to cancel check subscription!');
    });
  }

}
