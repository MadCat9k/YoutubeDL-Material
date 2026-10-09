import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { PostsService } from 'app/posts.services';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-concurrent-stream',
  templateUrl: './concurrent-stream.component.html',
  styleUrls: ['./concurrent-stream.component.scss']
})
export class ConcurrentStreamComponent implements OnChanges, OnDestroy {

  @Input() server_mode = false;
  @Input() playback_timestamp;
  @Input() playing;
  @Input() uid;

  @Output() setPlaybackTimestamp = new EventEmitter<any>();
  @Output() togglePlayback = new EventEmitter<boolean>();
  @Output() setPlaybackRate = new EventEmitter<number>();

  started = false;
  server_started = false;
  watch_together_clicked = false;

  server_already_exists = null;

  check_timeout: any;
  update_timeout: any;
  playback_rate_timeout: any;
  check_request: Subscription = null;
  update_request: Subscription = null;
  check_request_in_flight = false;
  update_request_in_flight = false;
  check_polling_stopped = true;
  update_polling_stopped = true;
  stream_connection_error = false;
  consecutive_poll_failures = 0;
  request_generation = 0;
  readonly stream_poll_interval = 1000;

  PLAYBACK_TIMESTAMP_DIFFERENCE_THRESHOLD_PLAYBACK_MODIFICATION = 0.5;
  PLAYBACK_TIMESTAMP_DIFFERENCE_THRESHOLD_SKIP = 2;

  PLAYBACK_MODIFIER = 0.1;

  playback_rate_modified = false;

  constructor(private postsService: PostsService) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.uid && !changes.uid.firstChange) {
      this.resetStreamState();
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  // flow: click start watching -> check for available stream to enable join button and if user, display "start stream"
  // users who join a stream will send continuous requests for info on playback

  startServer(): void {
    this.started = true;
    this.server_started = true;
    this.request_generation += 1;
    this.stopCheckPolling();
    this.startUpdatePolling();
  }

  startUpdatePolling(): void {
    this.update_polling_stopped = false;
    if (this.update_timeout) clearTimeout(this.update_timeout);
    this.updateStream(true);
  }

  updateStream(scheduleNextPoll = false): void {
    if (this.update_polling_stopped || this.update_request_in_flight) return;

    const requestedUid = this.uid;
    const requestGeneration = this.request_generation;
    this.update_request_in_flight = true;
    const request = this.postsService.updateConcurrentStream(
      requestedUid,
      this.playback_timestamp,
      Date.now()/1000,
      this.playing
    ).subscribe(() => {
      if (requestGeneration !== this.request_generation || requestedUid !== this.uid) return;
      this.markStreamRefreshSucceeded();
    }, () => {
      if (requestGeneration === this.request_generation && requestedUid === this.uid) {
        this.markStreamRefreshFailed();
      }
      this.finishUpdateRequest(scheduleNextPoll, requestGeneration, requestedUid);
    }, () => {
      this.finishUpdateRequest(scheduleNextPoll, requestGeneration, requestedUid);
    });
    this.update_request = request.closed ? null : request;
  }

  startClient(): void {
    this.started = true;
  }

  startCheckPolling(): void {
    this.check_polling_stopped = false;
    if (this.check_timeout) clearTimeout(this.check_timeout);
    this.checkStream(true);
  }

  checkStream(scheduleNextPoll = false): void {
    if (this.server_started || this.check_polling_stopped || this.check_request_in_flight) return;

    const requestedUid = this.uid;
    const requestGeneration = this.request_generation;
    const current_playback_timestamp = this.playback_timestamp;
    const current_unix_timestamp = Date.now()/1000;
    this.check_request_in_flight = true;
    const request = this.postsService.checkConcurrentStream(requestedUid).subscribe(res => {
      if (requestGeneration !== this.request_generation || requestedUid !== this.uid) return;
      this.markStreamRefreshSucceeded();
      const stream = res['stream'];

      if (!stream) {
        this.server_already_exists = false;
        return;
      }

      this.server_already_exists = true;

      // check whether client has joined the stream
      if (!this.started) { return; }

      if (!stream['playing'] && this.playing) {
        // tell client to pause and set the timestamp to sync
        this.togglePlayback.emit(false);
        this.setPlaybackTimestamp.emit(stream['playback_timestamp']);
      } else if (stream['playing']) {
        // sync unpause state
        if (!this.playing) { this.togglePlayback.emit(true); }

        // sync time
        const zeroed_local_unix_timestamp = current_unix_timestamp - current_playback_timestamp;
        const zeroed_server_unix_timestamp = stream['unix_timestamp'] - stream['playback_timestamp'];

        const seconds_behind_locally = zeroed_local_unix_timestamp - zeroed_server_unix_timestamp;

        if (Math.abs(seconds_behind_locally) > this.PLAYBACK_TIMESTAMP_DIFFERENCE_THRESHOLD_SKIP) {
          // skip to playback timestamp because the difference is too high
          this.setPlaybackTimestamp.emit(this.playback_timestamp + seconds_behind_locally + 0.3);
          this.playback_rate_modified = false;
        } else if (!this.playback_rate_modified && Math.abs(seconds_behind_locally) > this.PLAYBACK_TIMESTAMP_DIFFERENCE_THRESHOLD_PLAYBACK_MODIFICATION) {
          // increase playback speed to avoid skipping
          let seconds_to_wait = (Math.abs(seconds_behind_locally)/this.PLAYBACK_MODIFIER);
          seconds_to_wait += 0.3/this.PLAYBACK_MODIFIER;

          this.playback_rate_modified = true;

          if (seconds_behind_locally > 0) {
            // increase speed
            this.setTemporaryPlaybackRate(1 + this.PLAYBACK_MODIFIER, seconds_to_wait);
          } else {
            // decrease speed
            this.setTemporaryPlaybackRate(1 - this.PLAYBACK_MODIFIER, seconds_to_wait);
          }
        }
      }
    }, () => {
      if (requestGeneration === this.request_generation && requestedUid === this.uid) {
        this.markStreamRefreshFailed();
      }
      this.finishCheckRequest(scheduleNextPoll, requestGeneration, requestedUid);
    }, () => {
      this.finishCheckRequest(scheduleNextPoll, requestGeneration, requestedUid);
    });
    this.check_request = request.closed ? null : request;
  }

  startWatching(): void {
    this.watch_together_clicked = true;
    this.startCheckPolling();
  }

  stop(): void {
    this.stopPolling();
    this.started = false;
    this.server_started = false;
    this.watch_together_clicked = false;
    this.server_already_exists = null;
    this.stream_connection_error = false;
    this.consecutive_poll_failures = 0;
  }

  resetStreamState(): void {
    this.stop();
  }

  stopPolling(): void {
    this.request_generation += 1;
    this.stopCheckPolling();
    this.stopUpdatePolling();
    if (this.playback_rate_timeout) clearTimeout(this.playback_rate_timeout);
    this.playback_rate_timeout = null;
    if (this.playback_rate_modified) this.setPlaybackRate.emit(1);
    this.playback_rate_modified = false;
  }

  stopCheckPolling(): void {
    this.check_polling_stopped = true;
    if (this.check_timeout) clearTimeout(this.check_timeout);
    this.check_timeout = null;
    this.check_request?.unsubscribe();
    this.check_request = null;
    this.check_request_in_flight = false;
  }

  stopUpdatePolling(): void {
    this.update_polling_stopped = true;
    if (this.update_timeout) clearTimeout(this.update_timeout);
    this.update_timeout = null;
    this.update_request?.unsubscribe();
    this.update_request = null;
    this.update_request_in_flight = false;
  }

  finishCheckRequest(scheduleNextPoll: boolean, requestGeneration: number, requestedUid: string): void {
    this.check_request = null;
    this.check_request_in_flight = false;
    if (scheduleNextPoll && !this.check_polling_stopped && !this.server_started
      && requestGeneration === this.request_generation && requestedUid === this.uid) {
      this.check_timeout = setTimeout(() => this.checkStream(true), this.getNextPollDelay());
    }
  }

  finishUpdateRequest(scheduleNextPoll: boolean, requestGeneration: number, requestedUid: string): void {
    this.update_request = null;
    this.update_request_in_flight = false;
    if (scheduleNextPoll && !this.update_polling_stopped && this.server_started
      && requestGeneration === this.request_generation && requestedUid === this.uid) {
      this.update_timeout = setTimeout(() => this.updateStream(true), this.getNextPollDelay());
    }
  }

  markStreamRefreshSucceeded(): void {
    this.stream_connection_error = false;
    this.consecutive_poll_failures = 0;
  }

  markStreamRefreshFailed(): void {
    this.stream_connection_error = true;
    this.consecutive_poll_failures += 1;
  }

  getNextPollDelay(): number {
    if (!this.stream_connection_error) return this.stream_poll_interval;
    const backoffMultiplier = Math.pow(2, Math.min(this.consecutive_poll_failures, 5));
    return Math.min(this.stream_poll_interval * backoffMultiplier, 30000);
  }

  setTemporaryPlaybackRate(playbackRate: number, secondsToWait: number): void {
    this.setPlaybackRate.emit(playbackRate);
    if (this.playback_rate_timeout) clearTimeout(this.playback_rate_timeout);
    this.playback_rate_timeout = setTimeout(() => {
      this.setPlaybackRate.emit(1);
      this.playback_rate_modified = false;
      this.playback_rate_timeout = null;
    }, secondsToWait * 1000);
  }
}
