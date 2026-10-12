import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { LocationStrategy } from '@angular/common';
import { BehaviorSubject, of, Subject } from 'rxjs';

import { PostsService } from 'app/posts.services';
import { RecentVideosComponent } from './recent-videos.component';

describe('RecentVideosComponent', () => {
  let component: RecentVideosComponent;
  let fixture: ComponentFixture<RecentVideosComponent>;
  let postsService: jasmine.SpyObj<PostsService> & {
    service_initialized: BehaviorSubject<boolean>;
    files_changed: BehaviorSubject<boolean>;
    playlists_changed: BehaviorSubject<boolean>;
    initialized: boolean;
  };
  let fileResponses: {[subId: string]: Subject<any>};
  let router: jasmine.SpyObj<Router>;
  let locationStrategy: jasmine.SpyObj<LocationStrategy>;

  beforeEach(async () => {
    fileResponses = {
      subscriptionA: new Subject(),
      subscriptionB: new Subject(),
      subscriptionC: new Subject()
    };

    postsService = Object.assign(
      jasmine.createSpyObj<PostsService>('PostsService', ['getAllFiles', 'getPlaylists']),
      {
        service_initialized: new BehaviorSubject(true),
        files_changed: new BehaviorSubject(true),
        playlists_changed: new BehaviorSubject(true),
        initialized: true,
        config: {Extra: {download_only_mode: false}}
      }
    );
    postsService.getAllFiles.and.callFake((sort, range, text, type, favorite, subId) => fileResponses[subId]);
    postsService.getPlaylists.and.returnValue(of({playlists: []} as any));

    router = jasmine.createSpyObj<Router>('Router', ['navigate', 'createUrlTree', 'serializeUrl']);
    Object.defineProperty(router, 'url', {value: '/subscription;id=subscriptionA'});
    router.createUrlTree.and.returnValue({} as any);
    router.serializeUrl.and.returnValue('/player;uid=file-1;type=video');
    locationStrategy = jasmine.createSpyObj<LocationStrategy>('LocationStrategy', ['prepareExternalUrl']);

    await TestBed.configureTestingModule({
      declarations: [RecentVideosComponent],
      providers: [
        {provide: PostsService, useValue: postsService},
        {provide: Router, useValue: router},
        {provide: LocationStrategy, useValue: locationStrategy}
      ]
    })
      .overrideComponent(RecentVideosComponent, {set: {template: ''}})
      .compileComponents();

    localStorage.clear();
    fixture = TestBed.createComponent(RecentVideosComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('reloads and resets subscription state when sub_id changes on the same instance', () => {
    localStorage.setItem('cached_file_count_subscriptionA', '7');
    localStorage.setItem('cached_file_count_subscriptionB', '2');

    fixture.componentRef.setInput('sub_id', 'subscriptionA');
    fixture.detectChanges();

    expect(postsService.getAllFiles.calls.mostRecent().args[5]).toBe('subscriptionA');
    expect(component.cached_file_count).toBe(7);

    component.paginator = {pageIndex: 4} as any;
    component.paged_data = [{uid: 'old-file'}] as any;
    component.file_count = 42;
    component.search_mode = true;
    component.search_text = 'old search';

    fixture.componentRef.setInput('sub_id', 'subscriptionB');
    fixture.detectChanges();

    const latestArgs = postsService.getAllFiles.calls.mostRecent().args;
    expect(latestArgs[1]).toEqual([0, 10]);
    expect(latestArgs[2]).toBeNull();
    expect(latestArgs[5]).toBe('subscriptionB');
    expect(component.paginator.pageIndex).toBe(0);
    expect(component.paged_data).toBeNull();
    expect(component.file_count).toBe(0);
    expect(component.cached_file_count).toBe(2);
    expect(component.loading_files.length).toBe(2);
  });

  it('does not let a slower request for the previous subscription overwrite the new result', () => {
    fixture.componentRef.setInput('sub_id', 'subscriptionA');
    fixture.detectChanges();

    fixture.componentRef.setInput('sub_id', 'subscriptionB');
    fixture.detectChanges();

    fileResponses.subscriptionB.next({
      file_count: 1,
      files: [{uid: 'file-b', duration: 10}]
    });
    fileResponses.subscriptionA.next({
      file_count: 1,
      files: [{uid: 'file-a', duration: 20}]
    });

    expect(component.paged_data.map(file => file.uid)).toEqual(['file-b']);
    expect(localStorage.getItem('cached_file_count_subscriptionB')).toBe('1');
    expect(localStorage.getItem('cached_file_count_subscriptionA')).toBeNull();
  });

  it('keeps one event subscription and one active file request across repeated navigation', () => {
    fixture.componentRef.setInput('sub_id', 'subscriptionA');
    fixture.detectChanges();
    fixture.componentRef.setInput('sub_id', 'subscriptionB');
    fixture.detectChanges();
    fixture.componentRef.setInput('sub_id', 'subscriptionC');
    fixture.detectChanges();

    expect(postsService.getAllFiles).toHaveBeenCalledTimes(3);
    expect(fileResponses.subscriptionA.observers.length).toBe(0);
    expect(fileResponses.subscriptionB.observers.length).toBe(0);
    expect(fileResponses.subscriptionC.observers.length).toBe(1);

    postsService.files_changed.next(true);
    expect(postsService.getAllFiles).toHaveBeenCalledTimes(4);
    expect(postsService.getAllFiles.calls.mostRecent().args[5]).toBe('subscriptionC');
    expect(fileResponses.subscriptionC.observers.length).toBe(1);

    fixture.destroy();
    postsService.files_changed.next(true);
    expect(postsService.getAllFiles).toHaveBeenCalledTimes(4);
    expect(fileResponses.subscriptionC.observers.length).toBe(0);
  });

  it('opens an Angular-generated player URL in a new tab for root and subpath hosting', () => {
    const openSpy = spyOn(window, 'open');
    const file = {uid: 'file-1', isAudio: false} as any;

    locationStrategy.prepareExternalUrl.and.returnValue('/#/player;uid=file-1;type=video');
    component.navigateToFile(file, true);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/player', {uid: 'file-1', type: 'video'}]);
    expect(locationStrategy.prepareExternalUrl).toHaveBeenCalledWith('/player;uid=file-1;type=video');
    expect(openSpy).toHaveBeenCalledWith('/#/player;uid=file-1;type=video', '_blank', 'noopener');

    openSpy.calls.reset();
    locationStrategy.prepareExternalUrl.and.returnValue('/youtube-dl/#/player;uid=file-1;type=video');
    component.navigateToFile(file, true);
    expect(openSpy).toHaveBeenCalledWith('/youtube-dl/#/player;uid=file-1;type=video', '_blank', 'noopener');
  });

  it('treats Cmd-click and middle-click as new-tab navigation', () => {
    const file = {uid: 'file-1', isAudio: false} as any;
    const navigateSpy = spyOn(component, 'navigateToFile');

    component.goToFile({file, event: {ctrlKey: false, metaKey: true, button: 0}});
    expect(component.navigateToFile).toHaveBeenCalledWith(file, true);

    navigateSpy.calls.reset();
    component.goToFile({file, event: {ctrlKey: false, metaKey: false, button: 1}});
    expect(component.navigateToFile).toHaveBeenCalledWith(file, true);
  });

  it('generates and opens the audio player route correctly in a new tab', () => {
    const openSpy = spyOn(window, 'open');
    const file = {uid: 'file-2', isAudio: true} as any;

    router.serializeUrl.and.returnValue('/player;uid=file-2;type=audio');
    locationStrategy.prepareExternalUrl.and.returnValue('/#/player;uid=file-2;type=audio');
    component.navigateToFile(file, true);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/player', {uid: 'file-2', type: 'audio'}]);
    expect(locationStrategy.prepareExternalUrl).toHaveBeenCalledWith('/player;uid=file-2;type=audio');
    expect(openSpy).toHaveBeenCalledWith('/#/player;uid=file-2;type=audio', '_blank', 'noopener');
  });

  it('resets pagination when search, sort, or media filters change', () => {
    fixture.componentRef.setInput('sub_id', 'subscriptionA');
    fixture.detectChanges();
    postsService.getAllFiles.calls.reset();
    component.paginator = {pageIndex: 4} as any;
    component.onSearchInputChanged('alpha');
    expect(component.paginator.pageIndex).toBe(0);

    component.paginator.pageIndex = 3;
    component.sortOptionChanged({by: 'title', order: 1});
    expect(component.paginator.pageIndex).toBe(0);

    component.paginator.pageIndex = 2;
    component.selectedFilters = [];
    component.selectedFiltersChanged({value: ['favorited']} as any);
    expect(component.paginator.pageIndex).toBe(0);
  });

  it('clears library search and media filters while preserving sort settings', () => {
    fixture.componentRef.setInput('sub_id', 'subscriptionA');
    fixture.detectChanges();
    postsService.getAllFiles.calls.reset();
    component.paginator = {pageIndex: 3} as any;
    component.search_text = '';
    component.search_mode = false;
    component.selectedFilters = ['favorited'];
    component.sortProperty = 'title';
    component.descendingMode = false;

    component.clearFilters();

    expect(component.search_text).toBe('');
    expect(component.search_mode).toBe(false);
    expect(component.selectedFilters).toEqual([]);
    expect(component.paginator.pageIndex).toBe(0);
    expect(component.sortProperty).toBe('title');
    expect(component.descendingMode).toBe(false);
    expect(localStorage.getItem('file_filter')).toBe('[]');
    expect(postsService.getAllFiles).toHaveBeenCalledTimes(1);
  });
});
