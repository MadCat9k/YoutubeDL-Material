import { Component, OnDestroy, OnInit } from '@angular/core';
import { PostsService } from 'app/posts.services';
import { ActivatedRoute, Router, ParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { EditSubscriptionDialogComponent } from 'app/dialogs/edit-subscription-dialog/edit-subscription-dialog.component';
import { Subscription } from 'api-types';
import { Subject, Subscription as RxSubscription } from 'rxjs';
import { distinctUntilChanged, filter, map, switchMap, take, takeUntil, tap } from 'rxjs/operators';

type SubscriptionCheckStatus = 'idle' | 'starting' | 'scanning' | 'cancelling' | 'completed' | 'cancelled' | 'failed';

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
  checkStatus: SubscriptionCheckStatus = 'idle';
  checkInitialVideoCount = 0;
  checkAddedCount = 0;
  checkCompletedAt: Date = null;
  readonly subscriptionCheckInterval = 1000;
  private destroy$ = new Subject<void>();
  private subscriptionRequest: RxSubscription = null;
  private checkRequest: RxSubscription = null;
  private cancelCheckRequest: RxSubscription = null;
  private downloadRequest: RxSubscription = null;
  private checkSawActiveScan = false;
  private checkIdlePolls = 0;
  private requestGeneration = 0;

  constructor(private postsService: PostsService, private route: ActivatedRoute, private router: Router, private dialog: MatDialog) { }

  ngOnInit() {
    this.route.params.pipe(
      map(params => params['id']),
      distinctUntilChanged(),
      tap(id => {
        this.stopSubscriptionPolling();
        this.cancelSubscriptionRequest();
        this.cancelCheckRequests();
        this.cancelDownloadRequest();
        this.requestGeneration++;
        this.id = id;
        this.subscription = null;
        this.subscriptionConnectionError = false;
        this.consecutivePollFailures = 0;
        this.resetCheckStatus();
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
    this.cancelCheckRequests();
    this.cancelDownloadRequest();
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
      this.updateCheckStatus(res['subscription']);
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

  private cancelCheckRequests(): void {
    this.checkRequest?.unsubscribe();
    this.cancelCheckRequest?.unsubscribe();
    this.checkRequest = null;
    this.cancelCheckRequest = null;
    this.check_clicked = false;
    this.cancel_clicked = false;
  }

  private cancelDownloadRequest(): void {
    this.downloadRequest?.unsubscribe();
    this.downloadRequest = null;
    this.downloading = false;
  }

  getConfig(): void {
    this.use_youtubedl_archive = this.postsService.config['Downloader']['use_youtubedl_archive'];
  }

  downloadContent(): void {
    if (!this.subscription || this.downloading || this.downloadRequest) return;

    const requestedId = this.subscription.id;
    const requestedName = this.subscription.name;
    this.downloading = true;
    const request = this.postsService.downloadSubFromServer(requestedId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: res => {
        if (requestedId !== this.id) return;
        try {
          this.saveSubscriptionArchive(res as Blob, requestedName);
          this.postsService.openSnackBar($localize`:@@subscription-download-success:Subscription download started.`);
        } catch (_) {
          this.showSubscriptionDownloadFailure();
        }
      },
      error: () => {
        if (requestedId === this.id) this.showSubscriptionDownloadFailure();
      }
    });
    this.downloadRequest = request.closed ? null : request;
    request.add(() => {
      if (this.downloadRequest === request) this.downloadRequest = null;
      if (requestedId === this.id) this.downloading = false;
    });
  }

  saveSubscriptionArchive(blob: Blob, subscriptionName: string): void {
    saveAs(blob, subscriptionName + '.zip');
  }

  private showSubscriptionDownloadFailure(): void {
    this.postsService.openSnackBar(
      $localize`:@@subscription-download-failed:Could not download subscription. Try again.`,
      $localize`Dismiss`
    );
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
    if (!this.subscription || this.check_clicked || this.cancel_clicked || this.checkRequest || this.subscription.downloading) return;
    const requestedId = this.subscription.id;
    this.check_clicked = true;
    this.checkStatus = 'starting';
    this.checkInitialVideoCount = this.subscription.videos.length;
    this.checkAddedCount = 0;
    this.checkCompletedAt = null;
    this.checkSawActiveScan = false;
    this.checkIdlePolls = 0;
    const request = this.postsService.checkSubscription(requestedId).subscribe(res => {
      if (requestedId !== this.id) return;
      this.check_clicked = false;
      if (!res?.['success']) {
        this.checkStatus = 'failed';
        return;
      }
      this.checkStatus = 'scanning';
    }, () => {
      if (requestedId !== this.id) return;
      this.check_clicked = false;
      this.checkStatus = 'failed';
    });
    this.checkRequest = request.closed ? null : request;
    request.add(() => {
      if (this.checkRequest === request) this.checkRequest = null;
    });
  }

  cancelCheckSubscription(): void {
    if (!this.subscription || this.cancel_clicked || this.cancelCheckRequest) return;
    const requestedId = this.subscription.id;
    this.cancel_clicked = true;
    this.checkStatus = 'cancelling';
    const request = this.postsService.cancelCheckSubscription(requestedId).subscribe(res => {
      if (requestedId !== this.id) return;
      this.cancel_clicked = false;
      if (!res?.['success']) {
        this.checkStatus = 'failed';
        return;
      }
      this.checkStatus = 'cancelled';
    }, () => {
      if (requestedId !== this.id) return;
      this.cancel_clicked = false;
      this.checkStatus = 'failed';
    });
    this.cancelCheckRequest = request.closed ? null : request;
    request.add(() => {
      if (this.cancelCheckRequest === request) this.cancelCheckRequest = null;
    });
  }

  private updateCheckStatus(nextSubscription: Subscription): void {
    if (this.checkStatus !== 'scanning') return;
    if (nextSubscription.downloading) {
      this.checkSawActiveScan = true;
      this.checkIdlePolls = 0;
      return;
    }
    this.checkIdlePolls += 1;
    if (!this.checkSawActiveScan && this.checkIdlePolls < 2) return;
    this.checkAddedCount = Math.max(nextSubscription.videos.length - this.checkInitialVideoCount, 0);
    this.checkCompletedAt = new Date();
    this.checkStatus = 'completed';
  }

  private resetCheckStatus(): void {
    this.checkStatus = 'idle';
    this.checkInitialVideoCount = 0;
    this.checkAddedCount = 0;
    this.checkCompletedAt = null;
    this.checkSawActiveScan = false;
    this.checkIdlePolls = 0;
  }

}
