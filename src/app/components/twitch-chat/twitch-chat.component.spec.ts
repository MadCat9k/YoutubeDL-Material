import { SimpleChange } from '@angular/core';
import { Subject } from 'rxjs';

import { PostsService } from 'app/posts.services';
import { TwitchChatComponent } from './twitch-chat.component';

describe('TwitchChatComponent', () => {
  let component: TwitchChatComponent;
  let postsService: jasmine.SpyObj<PostsService>;
  const syntheticFile = {
    id: 'synthetic-file',
    isAudio: false,
    url: ['twitch', '.tv/videos/', 'synthetic-vod'].join('')
  } as any;

  beforeEach(() => {
    postsService = jasmine.createSpyObj<PostsService>('PostsService', [
      'getFullTwitchChat',
      'downloadTwitchChat',
      'openSnackBar'
    ]);
    component = new TwitchChatComponent(postsService);
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('is safe to initialize before file data is available', () => {
    component.ngOnInit();

    expect(postsService.getFullTwitchChat).not.toHaveBeenCalled();
  });

  it('does not overlap requests for stored chat', () => {
    const response = new Subject<any>();
    postsService.getFullTwitchChat.and.returnValue(response.asObservable());
    component.db_file = syntheticFile;

    component.getFullChat();
    component.getFullChat();

    expect(postsService.getFullTwitchChat).toHaveBeenCalledTimes(1);

    response.next({chat: null});
    response.complete();
    component.getFullChat();

    expect(postsService.getFullTwitchChat).toHaveBeenCalledTimes(2);
  });

  it('cancels old-file work and reloads chat when the file changes', () => {
    const firstResponse = new Subject<any>();
    const secondResponse = new Subject<any>();
    postsService.getFullTwitchChat.and.returnValues(firstResponse.asObservable(), secondResponse.asObservable());
    component.db_file = syntheticFile;
    component.getFullChat();

    const replacementFile = {...syntheticFile, id: 'replacement-file'};
    component.db_file = replacementFile;
    component.ngOnChanges({
      db_file: new SimpleChange(syntheticFile, replacementFile, false)
    });

    expect(firstResponse.observers.length).toBe(0);
    expect(postsService.getFullTwitchChat).toHaveBeenCalledTimes(2);
    expect(secondResponse.observers.length).toBe(1);
  });

  it('replaces an existing chat interval when chat is reinitialized', () => {
    spyOn(window, 'clearInterval').and.callThrough();
    component.initializeChatCheck([]);
    const firstInterval = component.chat_check_interval_obj;

    component.initializeChatCheck([]);

    expect(window.clearInterval).toHaveBeenCalledWith(firstInterval);
  });

  it('rejects an unsupported VOD URL without starting a download', () => {
    component.db_file = {...syntheticFile, url: 'synthetic-video'};

    component.downloadTwitchChat();

    expect(postsService.downloadTwitchChat).not.toHaveBeenCalled();
    expect(component.downloading_chat).toBe(false);
    expect(postsService.openSnackBar).toHaveBeenCalled();
  });

  it('does not overlap Twitch chat download requests', () => {
    const response = new Subject<any>();
    postsService.downloadTwitchChat.and.returnValue(response.asObservable());
    component.db_file = syntheticFile;

    component.downloadTwitchChat();
    component.downloadTwitchChat();

    expect(postsService.downloadTwitchChat).toHaveBeenCalledTimes(1);
  });

  it('cancels active requests when destroyed', () => {
    const chatResponse = new Subject<any>();
    const downloadResponse = new Subject<any>();
    postsService.getFullTwitchChat.and.returnValue(chatResponse.asObservable());
    postsService.downloadTwitchChat.and.returnValue(downloadResponse.asObservable());
    component.db_file = syntheticFile;
    component.getFullChat();
    component.downloadTwitchChat();

    component.ngOnDestroy();

    expect(chatResponse.observers.length).toBe(0);
    expect(downloadResponse.observers.length).toBe(0);
    expect(component.chat_request).toBeNull();
    expect(component.download_request).toBeNull();
  });
});
