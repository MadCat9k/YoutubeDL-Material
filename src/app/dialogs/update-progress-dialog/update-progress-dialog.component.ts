import { Component, OnDestroy, OnInit } from '@angular/core';
import { PostsService } from 'app/posts.services';
import { UpdaterStatus } from '../../../api-types';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-update-progress-dialog',
  templateUrl: './update-progress-dialog.component.html',
  styleUrls: ['./update-progress-dialog.component.scss']
})
export class UpdateProgressDialogComponent implements OnInit, OnDestroy {

  updateStatus: UpdaterStatus = null;
  updateInterval = 250;
  errored = false;
  updateTimer: any = null;
  updateRequest: Subscription = null;
  requestInFlight = false;
  pollingStopped = true;
  connectionError = false;
  consecutivePollFailures = 0;

  constructor(private postsService: PostsService) { }

  ngOnInit(): void {
    this.startUpdatePolling();
  }

  ngOnDestroy(): void {
    this.pollingStopped = true;
    if (this.updateTimer) clearTimeout(this.updateTimer);
    this.updateRequest?.unsubscribe();
    this.updateRequest = null;
    this.requestInFlight = false;
  }

  startUpdatePolling(): void {
    this.pollingStopped = false;
    if (this.updateTimer) clearTimeout(this.updateTimer);
    this.getUpdateProgress(true);
  }

  getUpdateProgress(scheduleNextPoll = false): void {
    if (this.pollingStopped || this.requestInFlight) return;

    this.requestInFlight = true;
    const request = this.postsService.getUpdaterStatus().subscribe(res => {
      if (res) {
        this.connectionError = false;
        this.consecutivePollFailures = 0;
        this.updateStatus = res;
        if (this.updateStatus && this.updateStatus['error']) {
          this.postsService.openSnackBar($localize`Update failed. Check logs for more details.`);
        }
      } else {
        this.markRefreshFailed();
      }
    }, () => {
      this.markRefreshFailed();
      this.finishUpdateRequest(scheduleNextPoll);
    }, () => {
      this.finishUpdateRequest(scheduleNextPoll);
    });
    this.updateRequest = request.closed ? null : request;
  }

  markRefreshFailed(): void {
    this.connectionError = true;
    this.consecutivePollFailures += 1;
  }

  finishUpdateRequest(scheduleNextPoll: boolean): void {
    this.updateRequest = null;
    this.requestInFlight = false;
    if (scheduleNextPoll && (this.connectionError || this.updateStatus?.updating)) {
      this.scheduleUpdatePoll();
    }
  }

  scheduleUpdatePoll(): void {
    if (this.pollingStopped) return;
    this.updateTimer = setTimeout(() => this.getUpdateProgress(true), this.getNextPollDelay());
  }

  getNextPollDelay(): number {
    if (!this.connectionError) return this.updateInterval;
    const backoffMultiplier = Math.pow(2, Math.min(this.consecutivePollFailures, 7));
    return Math.min(this.updateInterval * backoffMultiplier, 30000);
  }
}
