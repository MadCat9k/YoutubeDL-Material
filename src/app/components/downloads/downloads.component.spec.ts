import { Clipboard } from '@angular/cdk/clipboard';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { Download } from 'api-types';
import { PostsService } from 'app/posts.services';
import { DownloadsComponent } from './downloads.component';

describe('DownloadsComponent', () => {
  let component: DownloadsComponent;
  let postsService: jasmine.SpyObj<PostsService>;
  let dialog: jasmine.SpyObj<MatDialog>;

  beforeEach(() => {
    postsService = jasmine.createSpyObj<PostsService>('PostsService', [
      'getCurrentDownloads',
      'clearCompletedDownloads',
      'clearDownload',
      'pauseDownload',
      'pauseAllDownloads',
      'resumeDownload',
      'resumeAllDownloads',
      'restartDownload',
      'cancelDownload',
      'openSnackBar'
    ]);
    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    component = new DownloadsComponent(
      postsService,
      {} as Router,
      dialog,
      {} as Clipboard
    );
  });

  afterEach(() => {
    localStorage.removeItem('downloads_view_state');
    component.ngOnDestroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('labels downloads waiting for a worker as queued', () => {
    expect(component.STEP_INDEX_TO_LABEL[0]).toBe('Queued');
  });

  it('preserves valid falsy download values while merging updates', () => {
    const existing = [{
      uid: 'synthetic-download',
      title: 'Previous title',
      step_index: 1,
      percent_complete: 12,
      paused: true,
      obsolete: 'remove me'
    }];
    const update = [{
      uid: 'synthetic-download',
      title: '',
      step_index: 0,
      percent_complete: 0,
      paused: false
    }];

    const result = component.combineDownloads(existing as any, update as any);

    expect(result as any).toEqual([{
      uid: 'synthetic-download',
      title: '',
      step_index: 0,
      percent_complete: 0,
      paused: false
    }]);
  });

  it('uses compact columns and the action menu below the mobile breakpoint', () => {
    component.innerWidth = 455;

    component.recalculateColumns();

    expect(component.displayedColumns).toEqual(['select', 'title', 'percent_complete', 'actions']);
    expect(component.actionsFlex).toBe(1);
    expect(component.minimizeButtons).toBe(true);
  });

  it('maps each download into one deterministic filter status', () => {
    expect(component.getDownloadStatus({step_index: 0} as Download)).toBe('queued');
    expect(component.getDownloadStatus({step_index: 2} as Download)).toBe('active');
    expect(component.getDownloadStatus({paused: true, finished: false} as Download)).toBe('paused');
    expect(component.getDownloadStatus({finished: true} as Download)).toBe('completed');
    expect(component.getDownloadStatus({cancelled: true, finished: true} as Download)).toBe('cancelled');
    expect(component.getDownloadStatus({error: 'synthetic failure', cancelled: true} as Download)).toBe('failed');
  });

  it('combines title search and status filtering', () => {
    component.downloads = [
      {uid: 'queued', title: 'Alpha item', sub_name: 'First feed', step_index: 0} as Download,
      {uid: 'active', title: 'Beta item', sub_name: 'Second feed', step_index: 2} as Download,
      {uid: 'failed', title: 'Gamma item', sub_name: 'First feed', step_index: 2, error: 'synthetic failure'} as Download
    ];
    component.configureDataSource();

    component.updateSearch('first');
    component.updateStatusFilter('queued');

    expect(component.dataSource.filteredData.map(download => download.uid)).toEqual(['queued']);
  });

  it('restores valid filter state and keeps it after polling refreshes data', () => {
    const response = new Subject<any>();
    localStorage.setItem('downloads_view_state', JSON.stringify({search: 'alpha', status: 'queued'}));
    postsService.initialized = true;
    postsService.config = {Extra: {enable_downloads_manager: true}} as any;
    postsService.getCurrentDownloads.and.returnValue(response.asObservable());

    component.ngOnInit();
    response.next({downloads: [
      {uid: 'matching', title: 'Alpha item', step_index: 0},
      {uid: 'wrong-status', title: 'Alpha active', step_index: 2},
      {uid: 'wrong-title', title: 'Beta item', step_index: 0}
    ]});

    expect(component.searchTerm).toBe('alpha');
    expect(component.statusFilter).toBe('queued');
    expect(component.dataSource.filteredData.map(download => download.uid)).toEqual(['matching']);
  });

  it('clears active filters and their saved view state', () => {
    component.downloads = [{uid: 'queued', title: 'Alpha item', step_index: 0} as Download];
    component.configureDataSource();
    component.updateSearch('missing');
    component.updateStatusFilter('failed');

    component.clearFilters();

    expect(component.hasActiveFilters()).toBe(false);
    expect(component.dataSource.filteredData.length).toBe(1);
    expect(JSON.parse(localStorage.getItem('downloads_view_state'))).toEqual({search: '', status: 'all'});
  });

  it('confirms and clears only completed downloads', () => {
    const afterClosed = new Subject<boolean>();
    dialog.open.and.returnValue({afterClosed: () => afterClosed.asObservable()} as any);
    postsService.clearCompletedDownloads.and.returnValue(of({success: true}));
    postsService.getCurrentDownloads.and.returnValue(of({downloads: []}));

    component.clearCompletedDownloads();
    expect(postsService.clearCompletedDownloads).not.toHaveBeenCalled();

    afterClosed.next(true);

    expect(postsService.clearCompletedDownloads).toHaveBeenCalledTimes(1);
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Completed downloads cleared.');
    expect(postsService.getCurrentDownloads).toHaveBeenCalledTimes(1);
  });

  it('selects only downloads visible through the current filters', () => {
    component.downloads = [
      {uid: 'queued-alpha', title: 'Alpha', step_index: 0} as Download,
      {uid: 'active-alpha', title: 'Alpha', step_index: 2} as Download,
      {uid: 'queued-beta', title: 'Beta', step_index: 0} as Download
    ];
    component.configureDataSource();
    component.updateSearch('alpha');
    component.updateStatusFilter('queued');

    component.toggleFilteredDownloadsSelection();

    expect(Array.from(component.selectedDownloadUids)).toEqual(['queued-alpha']);
    expect(component.allFilteredDownloadsSelected()).toBe(true);
  });

  it('removes selections for downloads that disappear during polling', () => {
    const response = new Subject<any>();
    component.downloads = [
      {uid: 'removed', title: 'Removed', step_index: 0} as Download,
      {uid: 'retained', title: 'Retained', step_index: 0} as Download
    ];
    component.selectedDownloadUids.add('removed');
    component.selectedDownloadUids.add('retained');
    postsService.getCurrentDownloads.and.returnValue(response.asObservable());

    component.getCurrentDownloads();
    response.next({downloads: [{uid: 'retained', title: 'Retained', step_index: 0}]});

    expect(Array.from(component.selectedDownloadUids)).toEqual(['retained']);
  });

  it('bulk clears selected completed or paused entries and keeps active entries', () => {
    const afterClosed = new Subject<boolean>();
    const completed = {uid: 'completed', title: 'Completed', finished: true, paused: false} as Download;
    const paused = {uid: 'paused', title: 'Paused', finished: false, paused: true} as Download;
    const active = {uid: 'active', title: 'Active', finished: false, paused: false} as Download;
    component.downloads = [completed, paused, active];
    component.configureDataSource();
    component.selectedDownloadUids = new Set(['completed', 'paused', 'active']);
    dialog.open.and.returnValue({afterClosed: () => afterClosed.asObservable()} as any);
    postsService.clearDownload.and.returnValue(of({success: true}));

    component.clearSelectedDownloads();
    afterClosed.next(true);

    expect(postsService.clearDownload.calls.allArgs()).toEqual([['completed'], ['paused']]);
    expect(component.downloads.map(download => download.uid)).toEqual(['active']);
    expect(Array.from(component.selectedDownloadUids)).toEqual(['active']);
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Selected downloads cleared.');
  });

  it('does not start another downloads request while one is in flight', () => {
    const response = new Subject<any>();
    postsService.getCurrentDownloads.and.returnValue(response.asObservable());

    component.getCurrentDownloads();
    component.getCurrentDownloads();

    expect(postsService.getCurrentDownloads).toHaveBeenCalledTimes(1);

    response.next({downloads: []});
    response.complete();
    component.getCurrentDownloads();

    expect(postsService.getCurrentDownloads).toHaveBeenCalledTimes(2);
  });

  it('marks refresh failures and clears the warning after recovery', () => {
    postsService.getCurrentDownloads.and.returnValue(throwError(() => new Error('synthetic failure')));

    component.getCurrentDownloads();

    expect(component.downloads_connection_error).toBe(true);
    expect(component.consecutive_poll_failures).toBe(1);
    expect(component.getNextPollDelay()).toBe(2000);

    postsService.getCurrentDownloads.and.returnValue(of({downloads: []}));
    component.getCurrentDownloads();

    expect(component.downloads_connection_error).toBe(false);
    expect(component.consecutive_poll_failures).toBe(0);
    expect(component.getNextPollDelay()).toBe(1000);
  });

  it('cancels an in-flight downloads request when destroyed', () => {
    const response = new Subject<any>();
    postsService.getCurrentDownloads.and.returnValue(response.asObservable());
    component.getCurrentDownloads();

    component.ngOnDestroy();

    expect(response.observers.length).toBe(0);
    expect(component.downloads_request_in_flight).toBe(false);
  });

  it('announces successful download actions', () => {
    postsService.pauseDownload.and.returnValue(of({success: true}));

    component.pauseDownload({uid: 'synthetic-download'} as Download);

    expect(postsService.pauseDownload).toHaveBeenCalledWith('synthetic-download');
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Pause succeeded.');
  });

  it('announces rejected and failed download actions with a retry cue', () => {
    postsService.clearDownload.and.returnValue(of({success: false}));
    postsService.resumeDownload.and.returnValue(throwError(() => new Error('synthetic failure')));

    component.clearDownload({uid: 'clear-download'} as Download);
    component.resumeDownload({uid: 'resume-download'} as Download);

    expect(postsService.openSnackBar.calls.allArgs()).toEqual([
      ['Clear failed. Try again.'],
      ['Resume failed. Try again.']
    ]);
  });

  it('preserves the replacement uid after a successful restart', () => {
    component.uids = ['synthetic-download'];
    postsService.restartDownload.and.returnValue(of({success: true, new_download_uid: 'replacement-download'}));

    component.restartDownload({uid: 'synthetic-download'} as Download);

    expect(component.uids).toEqual(['synthetic-download', 'replacement-download']);
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Restart succeeded.');
  });

  it('cancels an in-flight download action when destroyed', () => {
    const response = new Subject<any>();
    postsService.cancelDownload.and.returnValue(response);

    component.cancelDownload({uid: 'synthetic-download'} as Download);
    component.ngOnDestroy();
    response.next({success: true});

    expect(response.observers.length).toBe(0);
    expect(postsService.openSnackBar).not.toHaveBeenCalled();
  });
});
