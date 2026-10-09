import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { PostsService } from 'app/posts.services';
import CryptoJS from 'crypto-js';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-skip-ad-button',
  templateUrl: './skip-ad-button.component.html',
  styleUrls: ['./skip-ad-button.component.scss']
})
export class SkipAdButtonComponent implements OnInit, OnChanges, OnDestroy {

  @Input() current_video = null;
  @Input() playback_timestamp = null;
  
  @Output() setPlaybackTimestamp = new EventEmitter<any>();

  sponsor_block_cache = {};
  sponsor_block_requests: {[url: string]: Subscription} = {};
  show_skip_ad_button = false;

  skip_ad_button_check_interval = null;

  constructor(private postsService: PostsService) { }

  ngOnInit(): void {
    this.skip_ad_button_check_interval = setInterval(() => this.skipAdButtonCheck(), 500);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.current_video) {
      this.show_skip_ad_button = false;
      if (!changes.current_video.firstChange) this.cancelSponsorBlockRequests();
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.skip_ad_button_check_interval);
    this.cancelSponsorBlockRequests();
  }

  checkSponsorBlock(video_to_check): void {
    if (!video_to_check?.url) return;

    const videoUrl = video_to_check.url;

    // check cache, null means it has been checked and confirmed not to exist (limits API calls)
    if (this.sponsor_block_cache[videoUrl] || this.sponsor_block_cache[videoUrl] === null
      || this.sponsor_block_requests[videoUrl]) return;

    // sponsor block needs first 4 chars from video ID hash
    const video_id = this.getVideoIDFromURL(videoUrl);
    const id_hash = this.getVideoIDHashFromURL(video_id);
    if (!id_hash || id_hash.length < 4) {
      this.sponsor_block_cache[videoUrl] = null;
      return;
    }
    const truncated_id_hash = id_hash.substring(0, 4);

    // we couldn't get the data from the cache, let's get it from sponsor block directly

    const request = this.postsService.getSponsorBlockDataForVideo(truncated_id_hash).subscribe(res => {
      const found_data = Array.isArray(res) ? res.find(data => data['videoID'] === video_id) : null;
      if (found_data) {
        this.sponsor_block_cache[videoUrl] = found_data;
      } else {
        this.sponsor_block_cache[videoUrl] = null;
      }
    }, () => {
      // likely doesn't exist
      this.sponsor_block_cache[videoUrl] = null;
      this.finishSponsorBlockRequest(videoUrl);
    }, () => {
      this.finishSponsorBlockRequest(videoUrl);
    });
    if (!request.closed) this.sponsor_block_requests[videoUrl] = request;
  }

  getVideoIDHashFromURL(video_id) {
    if (!video_id) return null;
    return CryptoJS.SHA256(video_id).toString(CryptoJS.enc.Hex);
  }

  getVideoIDFromURL(url) {
    const regex_exp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regex_exp);
    return (match && match[7].length==11) ? match[7] : null;
  }

  skipAdButtonCheck(): void {
    if (!this.current_video?.url) {
      this.show_skip_ad_button = false;
      return;
    }

    const sponsor_block_data = this.sponsor_block_cache[this.current_video.url];
    if (!sponsor_block_data && sponsor_block_data !== null) {
      // we haven't yet tried to get the sponsor block data for the video
      this.checkSponsorBlock(this.current_video);
    } else if (!sponsor_block_data) {
      this.show_skip_ad_button = false;
      return;
    }

    if (this.getTimeToSkipTo()) {
      this.show_skip_ad_button = true;
    } else {
      this.show_skip_ad_button = false;
    }
  }

  getTimeToSkipTo() {
    if (!this.current_video?.url) return null;
    const sponsor_block_data = this.sponsor_block_cache[this.current_video.url];

    if (!sponsor_block_data) return;

    // check if we're in between an ad segment
    const found_segment = sponsor_block_data['segments'].find(segment_data => this.playback_timestamp > segment_data.segment[0] && this.playback_timestamp < segment_data.segment[1] - 0.5);

    if (found_segment) {
      return found_segment['segment'][1];
    }

    return null;
  }

  skipAdButtonClicked() {
    const time_to_skip_to = this.getTimeToSkipTo();
    if (!time_to_skip_to) return;

    this.setPlaybackTimestamp.emit(time_to_skip_to);

    this.show_skip_ad_button = false;
  }

  finishSponsorBlockRequest(videoUrl: string): void {
    delete this.sponsor_block_requests[videoUrl];
  }

  cancelSponsorBlockRequests(): void {
    Object.values(this.sponsor_block_requests).forEach(request => request.unsubscribe());
    this.sponsor_block_requests = {};
  }

}
