import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, QueryList, SimpleChanges, ViewChild, ViewChildren } from '@angular/core';
import { DatabaseFile } from 'api-types';
import { PostsService } from 'app/posts.services';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-twitch-chat',
  templateUrl: './twitch-chat.component.html',
  styleUrls: ['./twitch-chat.component.scss']
})
export class TwitchChatComponent implements OnInit, OnChanges, OnDestroy {

  full_chat = null;
  visible_chat = null;
  chat_response_received = false;
  downloading_chat = false;

  current_chat_index = null;

  CHAT_CHECK_INTERVAL_MS = 200;
  chat_check_interval_obj = null;
  scroll_timeout = null;
  chat_request: Subscription = null;
  download_request: Subscription = null;
  request_generation = 0;

  scrollContainer = null;

  @Input() db_file: DatabaseFile = null;
  @Input() sub = null;
  @Input() current_timestamp = null;

  @ViewChild('scrollContainer') scrollRef: ElementRef;
  @ViewChildren('chat') chat: QueryList<any>;

  constructor(private postsService: PostsService) { }

  ngOnInit(): void {
    if (this.db_file) this.getFullChat();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const fileChanged = changes.db_file && !changes.db_file.firstChange;
    const subscriptionChanged = changes.sub && !changes.sub.firstChange;
    if (fileChanged || subscriptionChanged) {
      this.resetChatState();
      if (this.db_file) this.getFullChat();
    }
  }

  ngOnDestroy(): void {
    this.request_generation += 1;
    this.cancelChatWork();
  }

  private isUserNearBottom(): boolean {
    const threshold = 150;
    const position = this.scrollContainer.scrollTop + this.scrollContainer.offsetHeight;
    const height = this.scrollContainer.scrollHeight;
    return position > height - threshold;
  }

  scrollToBottom = (force_scroll = false) => {
    if (!this.scrollContainer) return;
    if (force_scroll || this.isUserNearBottom()) {
      this.scrollContainer.scrollTop = this.scrollContainer.scrollHeight;
    }
  }

  addNewChatMessages(): void {
    if (!this.full_chat || !this.visible_chat || !this.scrollRef) return;
    const next_chat_index = this.getIndexOfNextChat();
    if (!this.scrollContainer) {
      this.scrollContainer = this.scrollRef.nativeElement;
    }
    if (this.current_chat_index === null) {
      this.current_chat_index = next_chat_index;
    }

    if (Math.abs(next_chat_index - this.current_chat_index) > 25) {
      this.visible_chat = [];
      this.current_chat_index = next_chat_index - 25;
      if (this.scroll_timeout) clearTimeout(this.scroll_timeout);
      this.scroll_timeout = setTimeout(() => {
        this.scrollToBottom(true);
        this.scroll_timeout = null;
      }, 100);
    }

    const latest_chat_timestamp = this.visible_chat.length ? this.visible_chat[this.visible_chat.length - 1]['timestamp'] : 0;

    for (let i = this.current_chat_index + 1; i < this.full_chat.length; i++) {
      if (this.full_chat[i]['timestamp'] >= latest_chat_timestamp && this.full_chat[i]['timestamp'] <= this.current_timestamp) {
        this.visible_chat.push(this.full_chat[i]);
        this.current_chat_index = i;
      } else if (this.full_chat[i]['timestamp'] > this.current_timestamp) {
        break;
      }
    }
  }

  getIndexOfNextChat() {
    const index = binarySearch(this.full_chat, 'timestamp', this.current_timestamp);
    return index;
  }

  getFullChat(): void {
    if (!this.db_file || this.chat_request) return;

    const requestGeneration = this.request_generation;
    const requestedFileId = this.db_file.id;
    const request = this.postsService.getFullTwitchChat(
      requestedFileId,
      this.db_file.isAudio ? 'audio' : 'video',
      null,
      this.sub
    ).subscribe(res => {
      if (requestGeneration !== this.request_generation || requestedFileId !== this.db_file?.id) return;
      this.chat_response_received = true;
      if (res['chat']) {
        this.initializeChatCheck(res['chat']);
      }
    }, () => {
      if (requestGeneration === this.request_generation && requestedFileId === this.db_file?.id) {
        this.chat_response_received = true;
      }
      this.finishChatRequest(requestGeneration, requestedFileId);
    }, () => {
      this.finishChatRequest(requestGeneration, requestedFileId);
    });
    this.chat_request = request.closed ? null : request;
  }

  downloadTwitchChat(): void {
    if (!this.db_file || this.download_request) return;

    this.downloading_chat = true;
    const vodIdMatch = this.db_file.url?.match(/twitch\.tv\/videos\/([^/?#]+)/);
    const vodId = vodIdMatch?.[1];
    if (!vodId) {
      this.downloading_chat = false;
      this.postsService.openSnackBar($localize`VOD url for this video is not supported. VOD ID must be after "twitch.tv/videos/"`);
      return;
    }

    const requestGeneration = this.request_generation;
    const requestedFileId = this.db_file.id;
    const request = this.postsService.downloadTwitchChat(
      requestedFileId,
      this.db_file.isAudio ? 'audio' : 'video',
      vodId,
      null,
      this.sub
    ).subscribe(res => {
      if (requestGeneration !== this.request_generation || requestedFileId !== this.db_file?.id) return;
      this.downloading_chat = false;
      if (res['chat']) {
        this.initializeChatCheck(res['chat']);
      } else {
        this.postsService.openSnackBar($localize`Download failed.`)
      }
    }, () => {
      if (requestGeneration === this.request_generation && requestedFileId === this.db_file?.id) {
        this.downloading_chat = false;
        this.postsService.openSnackBar($localize`Chat could not be downloaded.`)
      }
      this.finishDownloadRequest(requestGeneration, requestedFileId);
    }, () => {
      this.finishDownloadRequest(requestGeneration, requestedFileId);
    });
    this.download_request = request.closed ? null : request;
  }

  initializeChatCheck(full_chat): void {
    if (this.chat_check_interval_obj) clearInterval(this.chat_check_interval_obj);
    this.full_chat = full_chat;
    this.visible_chat = [];
    this.current_chat_index = null;
    this.scrollContainer = null;
    this.chat_check_interval_obj = setInterval(() => this.addNewChatMessages(), this.CHAT_CHECK_INTERVAL_MS);
  }

  finishChatRequest(requestGeneration: number, requestedFileId: string): void {
    if (requestGeneration === this.request_generation && requestedFileId === this.db_file?.id) {
      this.chat_request = null;
    }
  }

  finishDownloadRequest(requestGeneration: number, requestedFileId: string): void {
    if (requestGeneration === this.request_generation && requestedFileId === this.db_file?.id) {
      this.download_request = null;
    }
  }

  resetChatState(): void {
    this.request_generation += 1;
    this.cancelChatWork();
    this.full_chat = null;
    this.visible_chat = null;
    this.chat_response_received = false;
    this.downloading_chat = false;
    this.current_chat_index = null;
    this.scrollContainer = null;
  }

  cancelChatWork(): void {
    if (this.chat_check_interval_obj) clearInterval(this.chat_check_interval_obj);
    if (this.scroll_timeout) clearTimeout(this.scroll_timeout);
    this.chat_check_interval_obj = null;
    this.scroll_timeout = null;
    this.chat_request?.unsubscribe();
    this.download_request?.unsubscribe();
    this.chat_request = null;
    this.download_request = null;
  }

}

function binarySearch(arr, key, n) {
  let min = 0;
  let max = arr.length - 1;
  let mid;
  while (min <= max) {
    // tslint:disable-next-line: no-bitwise
    mid = (min + max) >>> 1;
    if (arr[mid][key] === n) {
      return mid;
    } else if (arr[mid][key] < n) {
      min = mid + 1;
    } else {
      max = mid - 1;
    }
  }

  return min;
}
