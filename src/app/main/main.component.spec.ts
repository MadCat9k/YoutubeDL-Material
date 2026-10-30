import { Platform } from '@angular/cdk/platform';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { PostsService } from 'app/posts.services';
import { Result, YoutubeSearchService } from 'app/youtube-search.service';
import { MainComponent } from './main.component';

describe('MainComponent', () => {
  let component: MainComponent;
  let postsService: jasmine.SpyObj<PostsService>;
  let youtubeSearch: jasmine.SpyObj<YoutubeSearchService>;

  beforeEach(() => {
    postsService = jasmine.createSpyObj<PostsService>('PostsService', [
      'getCurrentDownload',
      'getFileFormats',
      'openSnackBar',
      'downloadFileFromServer',
      'downloadPlaylistFromServer',
      'deleteFile'
    ]);
    youtubeSearch = jasmine.createSpyObj<YoutubeSearchService>('YoutubeSearchService', ['search', 'ValidURL']);
    youtubeSearch.ValidURL.and.returnValue(false);
    component = new MainComponent(
      postsService,
      youtubeSearch,
      {} as MatSnackBar,
      {} as Router,
      {} as MatDialog,
      {} as Platform,
      {} as ActivatedRoute
    );
  });

  afterEach(() => component.ngOnDestroy());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('provides a localized name for the custom arguments action', () => {
    expect(component.mainActionLabels.customArgs).toBe('Custom arguments');
  });

  it('provides persistent labels for the primary URL and search input', () => {
    expect(component.mainInputLabels).toEqual({url: 'URL', search: 'Search'});
  });

  it('does not overlap active download progress requests', () => {
    const response = new Subject<any>();
    postsService.getCurrentDownload.and.returnValue(response.asObservable());
    component.current_download = {uid: 'synthetic-download'} as any;

    component.getCurrentDownload();
    component.getCurrentDownload();

    expect(postsService.getCurrentDownload).toHaveBeenCalledTimes(1);

    response.next({download: {uid: 'synthetic-download', finished: false, percent_complete: 10}});
    response.complete();
    component.getCurrentDownload();

    expect(postsService.getCurrentDownload).toHaveBeenCalledTimes(2);
  });

  it('ignores progress returned for a replaced download', () => {
    const response = new Subject<any>();
    postsService.getCurrentDownload.and.returnValue(response.asObservable());
    component.current_download = {uid: 'first-synthetic-download'} as any;

    component.getCurrentDownload();
    component.current_download = {uid: 'second-synthetic-download'} as any;
    response.next({download: {uid: 'first-synthetic-download', percent_complete: 80}});
    response.complete();

    expect(component.current_download.uid).toBe('second-synthetic-download');
  });

  it('backs off after a progress failure and recovers after success', () => {
    component.current_download = {uid: 'synthetic-download'} as any;
    postsService.getCurrentDownload.and.returnValue(throwError(() => new Error('synthetic failure')));

    component.getCurrentDownload();

    expect(component.currentDownloadConnectionError).toBe(true);
    expect(component.getNextPollDelay()).toBe(2000);

    postsService.getCurrentDownload.and.returnValue(of({
      download: {uid: 'synthetic-download', finished: false, percent_complete: 20}
    } as any));
    component.getCurrentDownload();

    expect(component.currentDownloadConnectionError).toBe(false);
    expect(component.getNextPollDelay()).toBe(1000);
  });

  it('cancels an active progress request when destroyed', () => {
    const response = new Subject<any>();
    postsService.getCurrentDownload.and.returnValue(response.asObservable());
    component.current_download = {uid: 'synthetic-download'} as any;
    component.getCurrentDownload();

    component.ngOnDestroy();

    expect(response.observers.length).toBe(0);
    expect(component.current_download_request_in_flight).toBe(false);
  });

  it('loads available formats and prevents duplicate requests', () => {
    const response = new Subject<any>();
    const parsedFormats = {video: [{key: 'Synthetic 720p'}], audio: []};
    postsService.getFileFormats.and.returnValue(response);
    spyOn(component, 'getAudioAndVideoFormats').and.returnValue(parsedFormats as any);

    component.getURLInfo('https://example.invalid/synthetic-video');
    component.getURLInfo('https://example.invalid/synthetic-video');

    expect(postsService.getFileFormats).toHaveBeenCalledTimes(1);
    expect(component.cachedAvailableFormats.get('https://example.invalid/synthetic-video').formats_loading).toBe(true);

    response.next({result: {formats: [{format_id: 'synthetic'}]}});
    response.complete();

    expect(component.cachedAvailableFormats.get('https://example.invalid/synthetic-video').formats).toBe(parsedFormats);
    expect(component.cachedAvailableFormats.get('https://example.invalid/synthetic-video').formats_loading).toBe(false);
  });

  it('keeps fallback qualities available and retries a failed format request', () => {
    postsService.getFileFormats.and.returnValues(
      throwError(() => new Error('synthetic format failure')),
      of({result: {formats: [{format_id: 'synthetic'}]}} as any)
    );
    spyOn(component, 'getAudioAndVideoFormats').and.returnValue({video: [], audio: []} as any);
    const url = 'https://example.invalid/synthetic-video';

    component.getURLInfo(url);

    expect(component.cachedAvailableFormats.get(url).formats_failed).toBe(true);
    expect(component.cachedAvailableFormats.get(url).formats_request_failed).toBe(true);

    component.retryFormats(url);

    expect(postsService.getFileFormats).toHaveBeenCalledTimes(2);
    expect(component.cachedAvailableFormats.get(url).formats_request_failed).toBe(false);
    expect(component.cachedAvailableFormats.get(url).formats).toEqual({video: [], audio: []});
  });

  it('keeps user-controlled format cache keys out of Object.prototype', () => {
    const response = new Subject<any>();
    postsService.getFileFormats.and.returnValue(response);

    component.getURLInfo('__proto__');

    expect((Object.prototype as any).formats_loading).toBeUndefined();
    expect(component.cachedAvailableFormats.get('__proto__').formats_loading).toBe(true);
  });

  it('cancels pending format requests when destroyed', () => {
    const response = new Subject<any>();
    const url = 'https://example.invalid/synthetic-video';
    postsService.getFileFormats.and.returnValue(response);

    component.getURLInfo(url);
    component.ngOnDestroy();

    expect(response.observers.length).toBe(0);
    expect(component.format_requests.size).toBe(0);
    expect(component.format_request_urls.size).toBe(0);
  });

  it('recovers from a failed search without ending future searches', () => {
    youtubeSearch.search.and.returnValues(
      throwError(() => new Error('synthetic search failure')),
      of([{title: 'Synthetic result'}] as Result[])
    );
    component.url = 'synthetic search';

    component.searchVideos('synthetic search');

    expect(component.search_failed).toBe(true);
    expect(component.results_showing).toBe(false);

    component.retrySearch();

    expect(youtubeSearch.search).toHaveBeenCalledTimes(2);
    expect(component.search_failed).toBe(false);
    expect(component.results_showing).toBe(true);
    expect(component.results[0].title).toBe('Synthetic result');
  });

  it('cancels a replaced search so stale results cannot overwrite the view', () => {
    const firstResponse = new Subject<Result[]>();
    const secondResponse = new Subject<Result[]>();
    youtubeSearch.search.and.returnValues(firstResponse, secondResponse);
    component.url = 'second synthetic search';

    component.searchVideos('first synthetic search');
    component.searchVideos('second synthetic search');

    expect(firstResponse.observers.length).toBe(0);
    firstResponse.next([{title: 'Stale result'}] as Result[]);
    secondResponse.next([{title: 'Current result'}] as Result[]);

    expect(component.results[0].title).toBe('Current result');
  });

  it('skips search requests for URLs and cancels active searches when destroyed', () => {
    const response = new Subject<Result[]>();
    youtubeSearch.search.and.returnValue(response);
    component.url = 'synthetic search';

    component.searchVideos('synthetic search');
    component.ngOnDestroy();

    expect(response.observers.length).toBe(0);
    expect(component.search_request).toBeNull();

    youtubeSearch.ValidURL.and.returnValue(true);
    component.searchVideos('https://example.invalid/synthetic-video');
    expect(youtubeSearch.search).toHaveBeenCalledTimes(1);
    expect(component.results_loading).toBe(false);
  });

  it('cancels search work and clears failed state when the input changes', () => {
    const response = new Subject<Result[]>();
    youtubeSearch.search.and.returnValue(response);
    component.url = 'synthetic search';
    component.searchVideos('synthetic search');
    component.search_failed = true;

    component.inputChanged('replacement synthetic search');

    expect(response.observers.length).toBe(0);
    expect(component.search_failed).toBe(false);
    expect(component.results_loading).toBe(false);
    expect(component.results_showing).toBe(false);
  });

  it('downloads a file and removes its server copy in download-only mode', () => {
    const fileBlob = new Blob(['synthetic media file']);
    const file = {uid: 'file-a', id: 'Synthetic%20file'} as any;
    component.fileManagerEnabled = false;
    postsService.downloadFileFromServer.and.returnValue(of(fileBlob));
    postsService.deleteFile.and.returnValue(of({success: true} as any));
    spyOn(component, 'saveExportedFile');

    component.downloadFileFromServer(file, 'video');

    expect(component.saveExportedFile).toHaveBeenCalledOnceWith(fileBlob, 'Synthetic file.mp4');
    expect(postsService.openSnackBar).toHaveBeenCalledWith('File download started.');
    expect(postsService.deleteFile).toHaveBeenCalledOnceWith('file-a');
  });

  it('preserves the server copy when saving a file fails', () => {
    const file = {uid: 'file-a', id: 'Synthetic%20file'} as any;
    component.fileManagerEnabled = false;
    postsService.downloadFileFromServer.and.returnValue(of(new Blob(['synthetic media file'])));
    spyOn(component, 'saveExportedFile').and.throwError('synthetic save failure');

    component.downloadFileFromServer(file, 'video');

    expect(postsService.openSnackBar).toHaveBeenCalledWith('Could not download file. Try again.', 'Dismiss');
    expect(postsService.deleteFile).not.toHaveBeenCalled();
  });

  it('reports file request and server-cleanup failures', () => {
    const file = {uid: 'file-a', id: 'Synthetic%20file'} as any;
    component.fileManagerEnabled = false;
    postsService.downloadFileFromServer.and.returnValues(
      throwError(() => new Error('synthetic request failure')),
      of(new Blob(['synthetic media file']))
    );
    postsService.deleteFile.and.returnValue(throwError(() => new Error('synthetic cleanup failure')));
    spyOn(component, 'saveExportedFile');

    component.downloadFileFromServer(file, 'video');
    component.downloadFileFromServer(file, 'video');

    expect(postsService.openSnackBar).toHaveBeenCalledWith('Could not download file. Try again.', 'Dismiss');
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'File downloaded, but the server copy could not be removed.',
      'Dismiss'
    );
  });

  it('downloads a completed playlist using its id', () => {
    const playlistBlob = new Blob(['synthetic playlist archive']);
    const playlist = {id: 'playlist-a', name: 'Synthetic playlist'} as any;
    component.autoplay = true;
    component.downloadOnlyMode = true;
    postsService.downloadPlaylistFromServer.and.returnValue(of(playlistBlob));
    spyOn(component, 'saveExportedPlaylist');
    spyOn(component, 'reloadRecentVideos');

    component.downloadHelper(playlist, 'video', true);

    expect(postsService.downloadPlaylistFromServer).toHaveBeenCalledOnceWith('playlist-a');
    expect(component.saveExportedPlaylist).toHaveBeenCalledOnceWith(playlistBlob, 'Synthetic playlist');
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Playlist download started.');
  });

  it('reports playlist request and local save failures', () => {
    const playlist = {id: 'playlist-a', name: 'Synthetic playlist'} as any;
    postsService.downloadPlaylistFromServer.and.returnValues(
      throwError(() => new Error('synthetic request failure')),
      of(new Blob(['synthetic playlist archive']))
    );
    spyOn(component, 'saveExportedPlaylist').and.throwError('synthetic save failure');

    component.downloadPlaylist(playlist);
    component.downloadPlaylist(playlist);

    expect(postsService.openSnackBar).toHaveBeenCalledTimes(2);
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not download playlist. Try again.',
      'Dismiss'
    );
  });

  it('blocks duplicate exports and cancels pending export work when destroyed', () => {
    const response = new Subject<Blob>();
    const playlist = {id: 'playlist-a', name: 'Synthetic playlist'} as any;
    postsService.downloadPlaylistFromServer.and.returnValue(response);
    spyOn(component, 'saveExportedPlaylist');

    component.downloadPlaylist(playlist);
    component.downloadPlaylist(playlist);

    expect(postsService.downloadPlaylistFromServer).toHaveBeenCalledTimes(1);
    component.ngOnDestroy();
    response.next(new Blob(['late synthetic response']));

    expect(response.observers.length).toBe(0);
    expect(component.saveExportedPlaylist).not.toHaveBeenCalled();
    expect(component.export_requests.size).toBe(0);
  });
});
