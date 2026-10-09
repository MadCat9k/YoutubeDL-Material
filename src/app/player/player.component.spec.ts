import { ChangeDetectorRef } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';

import { PostsService } from 'app/posts.services';
import { PlayerComponent } from './player.component';

describe('PlayerComponent', () => {
  let component: PlayerComponent;
  let postsService: jasmine.SpyObj<PostsService>;
  let paramMapSubject: Subject<any>;
  let initializationSubject: BehaviorSubject<boolean>;
  let cdr: jasmine.SpyObj<ChangeDetectorRef>;

  beforeEach(() => {
    postsService = jasmine.createSpyObj<PostsService>('PostsService', [
      'getFile',
      'getSubscription',
      'getPlaylist',
      'incrementViewCount',
      'openSnackBar',
      'downloadPlaylistFromServer',
      'downloadFileFromServer'
    ]);
    postsService.initialized = true;
    postsService.path = '/api/';
    postsService.config = {
      Downloader: {'path-audio': 'audio', 'path-video': 'video'},
      Subscriptions: {subscriptions_base_path: 'subscriptions'}
    } as any;
    initializationSubject = new BehaviorSubject<boolean>(false);
    postsService.service_initialized = initializationSubject;
    paramMapSubject = new Subject<any>();
    cdr = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['detectChanges']);
    component = new PlayerComponent(
      postsService,
      {paramMap: paramMapSubject.asObservable()} as ActivatedRoute,
      {} as MatDialog,
      {} as Router,
      cdr
    );
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('cancels old media loading when player route parameters change', () => {
    const firstResponse = new Subject<any>();
    const secondResponse = new Subject<any>();
    postsService.getFile.and.returnValues(firstResponse.asObservable(), secondResponse.asObservable());
    component.ngOnInit();

    paramMapSubject.next(convertToParamMap({uid: 'first-synthetic-file'}));
    paramMapSubject.next(convertToParamMap({uid: 'second-synthetic-file'}));

    expect(firstResponse.observers.length).toBe(0);
    expect(secondResponse.observers.length).toBe(1);
    expect(postsService.getFile).toHaveBeenCalledTimes(2);
    expect(component.uid).toBe('second-synthetic-file');
  });

  it('uses the latest route parameters when initialization finishes', () => {
    const response = new Subject<any>();
    postsService.initialized = false;
    postsService.getFile.and.returnValue(response.asObservable());
    component.ngOnInit();

    paramMapSubject.next(convertToParamMap({uid: 'first-synthetic-file'}));
    paramMapSubject.next(convertToParamMap({uid: 'second-synthetic-file'}));
    initializationSubject.next(true);

    expect(postsService.getFile).toHaveBeenCalledTimes(1);
    expect(postsService.getFile).toHaveBeenCalledWith('second-synthetic-file', null);
  });

  it('handles an already-complete initialization signal without retaining a subscription', () => {
    const response = new Subject<any>();
    postsService.initialized = false;
    postsService.getFile.and.returnValue(response.asObservable());
    initializationSubject.next(true);
    component.ngOnInit();

    paramMapSubject.next(convertToParamMap({uid: 'synthetic-file'}));

    expect(postsService.getFile).toHaveBeenCalledOnceWith('synthetic-file', null);
    expect(component.initialization_subscription).toBeNull();
  });

  it('releases initialization and route subscriptions when destroyed', () => {
    postsService.initialized = false;
    component.ngOnInit();
    paramMapSubject.next(convertToParamMap({uid: 'synthetic-file'}));

    component.ngOnDestroy();

    expect(paramMapSubject.observers.length).toBe(0);
    expect(initializationSubject.observers.length).toBe(0);
  });

  it('replaces media event subscriptions when the player is readied again', () => {
    const firstLoaded = new Subject<void>();
    const firstEnded = new Subject<void>();
    const secondLoaded = new Subject<void>();
    const secondEnded = new Subject<void>();
    const firstApi = createVideoApi(firstLoaded, firstEnded);
    const secondApi = createVideoApi(secondLoaded, secondEnded);

    component.onPlayerReady(firstApi as any);
    component.onPlayerReady(secondApi as any);

    expect(firstLoaded.observers.length).toBe(0);
    expect(firstEnded.observers.length).toBe(0);
    expect(secondLoaded.observers.length).toBe(1);
    expect(secondEnded.observers.length).toBe(1);
  });

  it('cancels active data and media work when destroyed', () => {
    const fileResponse = new Subject<any>();
    const loaded = new Subject<void>();
    const ended = new Subject<void>();
    postsService.getFile.and.returnValue(fileResponse.asObservable());
    component.ngOnInit();
    paramMapSubject.next(convertToParamMap({uid: 'synthetic-file'}));
    component.onPlayerReady(createVideoApi(loaded, ended) as any);

    component.ngOnDestroy();

    expect(fileResponse.observers.length).toBe(0);
    expect(loaded.observers.length).toBe(0);
    expect(ended.observers.length).toBe(0);
    expect(component.save_volume_timer).toBeNull();
  });
});

function createVideoApi(loadedMetadata: Subject<void>, ended: Subject<void>): any {
  return {
    volume: 1,
    getDefaultMedia: () => ({subscriptions: {loadedMetadata, ended}}),
    seekTime: jasmine.createSpy('seekTime'),
    play: jasmine.createSpy('play')
  };
}
