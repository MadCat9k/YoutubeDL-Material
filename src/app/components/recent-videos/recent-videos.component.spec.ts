import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { LocationStrategy } from '@angular/common';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';

import { PostsService } from 'app/posts.services';
import { DatabaseFile } from 'api-types';
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
      jasmine.createSpyObj<PostsService>('PostsService', [
        'getAllFiles',
        'getPlaylists',
        'downloadFileFromServer',
        'deleteFile',
        'deleteSubscriptionFile',
        'openSnackBar'
      ]),
      {
        service_initialized: new BehaviorSubject(true),
        files_changed: new BehaviorSubject(true),
        playlists_changed: new BehaviorSubject(true),
        initialized: true,
        config: {Extra: {download_only_mode: false, file_manager_enabled: true}}
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

  it('provides localized names for selection actions', () => {
    expect(component.selectionActionLabels).toEqual({
      reverseOrder: 'Reverse selection order',
      removeItem: 'Remove selected item'
    });
  });

  it('persists and restores the selected library page size', () => {
    postsService.getAllFiles.and.returnValue(of({file_count: 0, files: [], playlists: []}));

    component.pageChangeEvent({pageSize: 25});

    expect(localStorage.getItem('recent_videos_page_size')).toBe('25');

    fixture.destroy();
    fixture = TestBed.createComponent(RecentVideosComponent);
    component = fixture.componentInstance;

    expect(component.pageSize).toBe(25);
  });

  it('ignores an unsupported saved library page size', () => {
    localStorage.setItem('recent_videos_page_size', '999');

    fixture.destroy();
    fixture = TestBed.createComponent(RecentVideosComponent);
    component = fixture.componentInstance;

    expect(component.pageSize).toBe(10);
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

  it('exports a file once and reports when the browser download starts', () => {
    const response = new Subject<Blob>();
    const blob = new Blob(['synthetic file']);
    const file = {uid: 'file-1', id: 'Synthetic%20video', isAudio: false} as DatabaseFile;
    postsService.downloadFileFromServer.and.returnValue(response);
    spyOn(component, 'saveExportedFile');

    component.downloadFile(file);
    component.downloadFile(file);

    expect(postsService.downloadFileFromServer).toHaveBeenCalledOnceWith('file-1');
    expect(component.downloading_content['file-1']).toBeTrue();

    response.next(blob);
    response.complete();

    expect(component.saveExportedFile).toHaveBeenCalledOnceWith(blob, 'Synthetic video.mp4');
    expect(postsService.openSnackBar).toHaveBeenCalledWith('File download started.');
    expect(component.downloading_content['file-1']).toBeUndefined();
  });

  it('allows different files to export independently', () => {
    const responses = {
      'file-1': new Subject<Blob>(),
      'file-2': new Subject<Blob>()
    };
    postsService.downloadFileFromServer.and.callFake(uid => responses[uid]);
    spyOn(component, 'saveExportedFile');

    component.downloadFile({uid: 'file-1', id: 'First', isAudio: false} as DatabaseFile);
    component.downloadFile({uid: 'file-2', id: 'Second', isAudio: true} as DatabaseFile);

    expect(postsService.downloadFileFromServer.calls.allArgs()).toEqual([['file-1'], ['file-2']]);
    expect(component.downloading_content['file-1']).toBeTrue();
    expect(component.downloading_content['file-2']).toBeTrue();

    responses['file-1'].next(new Blob(['first file']));
    responses['file-1'].complete();
    responses['file-2'].next(new Blob(['second file']));
    responses['file-2'].complete();

    expect(component.saveExportedFile).toHaveBeenCalledWith(jasmine.any(Blob), 'First.mp4');
    expect(component.saveExportedFile).toHaveBeenCalledWith(jasmine.any(Blob), 'Second.mp3');
  });

  it('reports file export request failures and restores the card', () => {
    const response = new Subject<Blob>();
    postsService.downloadFileFromServer.and.returnValue(response);

    component.downloadFile({uid: 'file-1', id: 'Synthetic video', isAudio: false} as DatabaseFile);
    response.error(new Error('synthetic request failure'));

    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not download file. Try again.',
      'Dismiss'
    );
    expect(component.downloading_content['file-1']).toBeUndefined();
  });

  it('does not remove the server file when the local save fails', () => {
    postsService.config.Extra.file_manager_enabled = false;
    postsService.downloadFileFromServer.and.returnValue(of(new Blob(['synthetic file'])));
    spyOn(component, 'saveExportedFile').and.throwError('synthetic save failure');

    component.downloadFile({uid: 'file-1', id: 'Synthetic video', isAudio: false} as DatabaseFile);

    expect(postsService.deleteFile).not.toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not download file. Try again.',
      'Dismiss'
    );
  });

  it('removes a non-subscription server file only after the local save starts', () => {
    postsService.config.Extra.file_manager_enabled = false;
    postsService.downloadFileFromServer.and.returnValue(of(new Blob(['synthetic file'])));
    postsService.deleteFile.and.returnValue(of(true));
    spyOn(component, 'saveExportedFile');
    spyOn(component, 'getAllFiles');

    component.downloadFile({uid: 'file-1', id: 'Synthetic video', isAudio: false} as DatabaseFile);

    expect(component.saveExportedFile).toHaveBeenCalled();
    expect(postsService.deleteFile).toHaveBeenCalledOnceWith('file-1');
    expect(component.getAllFiles).toHaveBeenCalledTimes(1);
  });

  it('reports when the downloaded server copy could not be removed', () => {
    postsService.config.Extra.file_manager_enabled = false;
    postsService.downloadFileFromServer.and.returnValue(of(new Blob(['synthetic file'])));
    postsService.deleteFile.and.returnValue(of(false));
    spyOn(component, 'saveExportedFile');

    component.downloadFile({uid: 'file-1', id: 'Synthetic video', isAudio: false} as DatabaseFile);

    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'File downloaded, but the server copy could not be removed.',
      'Dismiss'
    );
  });

  it('cancels an in-flight export when the component is destroyed', () => {
    const response = new Subject<Blob>();
    postsService.downloadFileFromServer.and.returnValue(response);
    spyOn(component, 'saveExportedFile');

    component.downloadFile({uid: 'file-1', id: 'Synthetic video', isAudio: false} as DatabaseFile);
    expect(response.observers.length).toBe(1);

    fixture.destroy();
    response.next(new Blob(['late file']));

    expect(response.observers.length).toBe(0);
    expect(component.saveExportedFile).not.toHaveBeenCalled();
    expect(component.downloading_content['file-1']).toBeUndefined();
  });

  it('cancels an old subscription export when the input changes', () => {
    const response = new Subject<Blob>();
    postsService.downloadFileFromServer.and.returnValue(response);
    spyOn(component, 'saveExportedFile');
    fixture.componentRef.setInput('sub_id', 'subscriptionA');
    fixture.detectChanges();

    component.downloadFile({
      uid: 'file-1',
      id: 'Synthetic video',
      isAudio: false,
      sub_id: 'subscriptionA'
    } as DatabaseFile);

    fixture.componentRef.setInput('sub_id', 'subscriptionB');
    fixture.detectChanges();
    response.next(new Blob(['late file']));

    expect(response.observers.length).toBe(0);
    expect(component.saveExportedFile).not.toHaveBeenCalled();
    expect(component.downloading_content['file-1']).toBeUndefined();
  });

  it('deletes a normal file once and reports confirmed success', () => {
    const response = new Subject<boolean>();
    const file = {uid: 'file-1', id: 'Synthetic video', isAudio: false} as DatabaseFile;
    postsService.deleteFile.and.returnValue(response);
    spyOn(component, 'removeFileCard');

    component.deleteNormalFile(file);
    component.deleteNormalFile(file);

    expect(postsService.deleteFile).toHaveBeenCalledOnceWith('file-1', false);
    expect(component.downloading_content['file-1']).toBeTrue();

    response.next(true);
    response.complete();

    expect(postsService.openSnackBar).toHaveBeenCalledWith('Delete success!', 'OK.');
    expect(component.removeFileCard).toHaveBeenCalledOnceWith(file);
    expect(component.downloading_content['file-1']).toBeUndefined();
  });

  it('keeps normal files visible after rejected or failed deletions', () => {
    const firstFile = {uid: 'file-1', id: 'First', isAudio: false} as DatabaseFile;
    const secondFile = {uid: 'file-2', id: 'Second', isAudio: false} as DatabaseFile;
    postsService.deleteFile.and.returnValues(
      of(false),
      throwError(() => new Error('synthetic delete failure'))
    );
    spyOn(component, 'removeFileCard');

    component.deleteNormalFile(firstFile);
    component.deleteNormalFile(secondFile, true);

    expect(postsService.openSnackBar.calls.allArgs()).toEqual([
      ['Delete failed!', 'OK.'],
      ['Delete failed!', 'OK.']
    ]);
    expect(component.removeFileCard).not.toHaveBeenCalled();
  });

  it('checks subscription-file deletion results before removing the card', () => {
    const successfulFile = {uid: 'file-1', id: 'First', sub_id: 'subscriptionA'} as DatabaseFile;
    const rejectedFile = {uid: 'file-2', id: 'Second', sub_id: 'subscriptionA'} as DatabaseFile;
    postsService.deleteSubscriptionFile.and.returnValues(
      of({success: true}),
      of({success: false})
    );
    spyOn(component, 'removeFileCard');

    component.deleteAndRedownload(successfulFile);
    component.deleteForever(rejectedFile);

    expect(postsService.deleteSubscriptionFile.calls.allArgs()).toEqual([
      ['file-1', false],
      ['file-2', true]
    ]);
    expect(component.removeFileCard).toHaveBeenCalledOnceWith(successfulFile);
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Delete success!', 'OK.');
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Delete failed!', 'OK.');
  });

  it('cancels a pending deletion when the subscription input changes', () => {
    const response = new Subject<any>();
    postsService.deleteSubscriptionFile.and.returnValue(response);
    spyOn(component, 'removeFileCard');
    fixture.componentRef.setInput('sub_id', 'subscriptionA');
    fixture.detectChanges();

    component.deleteAndRedownload({
      uid: 'file-1',
      id: 'Synthetic video',
      sub_id: 'subscriptionA'
    } as DatabaseFile);

    fixture.componentRef.setInput('sub_id', 'subscriptionB');
    fixture.detectChanges();
    response.next({success: true});

    expect(response.observers.length).toBe(0);
    expect(component.removeFileCard).not.toHaveBeenCalled();
    expect(component.downloading_content['file-1']).toBeUndefined();
  });

  it('cancels a pending deletion when the component is destroyed', () => {
    const response = new Subject<boolean>();
    postsService.deleteFile.and.returnValue(response);
    spyOn(component, 'removeFileCard');

    component.deleteNormalFile({uid: 'file-1', id: 'Synthetic video'} as DatabaseFile);
    fixture.destroy();
    response.next(true);

    expect(response.observers.length).toBe(0);
    expect(component.removeFileCard).not.toHaveBeenCalled();
    expect(component.downloading_content['file-1']).toBeUndefined();
  });
});
