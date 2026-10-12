import { Component, OnInit, OnDestroy, ViewChild, Input, EventEmitter, HostListener } from '@angular/core';
import { PostsService } from 'app/posts.services';
import { trigger, transition, animateChild, stagger, query, style, animate } from '@angular/animations';
import { Router } from '@angular/router';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from 'app/dialogs/confirm-dialog/confirm-dialog.component';
import { MatSort } from '@angular/material/sort';
import { Clipboard } from '@angular/cdk/clipboard';
import { Download } from 'api-types';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-downloads',
  templateUrl: './downloads.component.html',
  styleUrls: ['./downloads.component.scss']
})
export class DownloadsComponent implements OnInit, OnDestroy {

  @Input() uids: string[] = null;

  downloads_check_interval = 1000;
  downloads = [];
  finished_downloads = [];
  interval_id = null;
  initialization_subscription: Subscription = null;
  downloads_request_subscription: Subscription = null;
  polling_stopped = false;
  downloads_request_in_flight = false;
  downloads_connection_error = false;
  consecutive_poll_failures = 0;

  keys = Object.keys;

  valid_sessions_length = 0;

  paused_download_exists = false;
  running_download_exists = false;
  completed_download_exists = false;

  STEP_INDEX_TO_LABEL = {
      0: $localize`:@@2827589726081052618:Queued`,
      1: $localize`Getting info`,
      2: $localize`Downloading file`,
      3: $localize`Complete`
  }

  actionsFlex = 2;
  minimizeButtons = false;
  displayedColumnsBig: string[] = ['select', 'timestamp_start', 'title', 'sub_name', 'percent_complete', 'actions'];
  displayedColumnsSmall: string[] = ['select', 'title', 'percent_complete', 'actions'];
  displayedColumns: string[] = this.displayedColumnsBig;
  dataSource = null; // new MatTableDataSource<Download>();
  searchTerm = '';
  statusFilter = 'all';
  readonly downloadsViewStateKey = 'downloads_view_state';
  readonly statusFilterOptions = [
    {value: 'all', label: $localize`:Downloads status filter@@downloads-filter-all:All statuses`},
    {value: 'queued', label: $localize`:Downloads status filter@@downloads-filter-queued:Queued`},
    {value: 'active', label: $localize`:Downloads status filter@@downloads-filter-active:Active`},
    {value: 'paused', label: $localize`:Downloads status filter@@downloads-filter-paused:Paused`},
    {value: 'completed', label: $localize`:Downloads status filter@@downloads-filter-completed:Completed`},
    {value: 'failed', label: $localize`:Downloads status filter@@downloads-filter-failed:Failed`},
    {value: 'cancelled', label: $localize`:Downloads status filter@@downloads-filter-cancelled:Cancelled`}
  ];
  selectedDownloadUids = new Set<string>();
  bulkActionInProgress = false;

  // The purpose of this is to reduce code reuse for displaying these actions as icons or in a menu
  downloadActions: DownloadAction[] = [
    {
      tooltip: $localize`Watch content`,
      action: (download: Download) => this.watchContent(download),
      show: (download: Download) => download.finished && !download.error,
      icon: 'smart_display'
    },
    {
      tooltip: $localize`Show error`,
      action: (download: Download) => this.showError(download),
      show: (download: Download) => download.finished && !!download.error,
      icon: 'warning'
    },
    {
      tooltip: $localize`Restart`,
      action: (download: Download) => this.restartDownload(download),
      show: (download: Download) => download.finished,
      icon: 'restart_alt'
    },
    {
      tooltip: $localize`Pause`,
      action: (download: Download) => this.pauseDownload(download),
      show: (download: Download) => !download.finished && (!download.paused || !download.finished_step),
      icon: 'pause'
    },
    {
      tooltip: $localize`Resume`,
      action: (download: Download) => this.resumeDownload(download),
      show: (download: Download) => !download.finished && download.paused && download.finished_step,
      icon: 'play_arrow'
    },
    {
      tooltip: $localize`Cancel`,
      action: (download: Download) => this.cancelDownload(download),
      show: (download: Download) => !download.finished && !download.paused && !download.cancelled,
      icon: 'cancel'
    },
    {
      tooltip: $localize`Clear`,
      action: (download: Download) => this.clearDownload(download),
      show: (download: Download) => download.finished || download.paused,
      icon: 'delete'
    }
  ]

  downloads_retrieved = false;

  innerWidth: number;

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.innerWidth = window.innerWidth;
    this.recalculateColumns();
  }

  sort_downloads = (a: Download, b: Download): number => {
    const result = b.timestamp_start - a.timestamp_start;
    return result;
  }

  constructor(public postsService: PostsService, private router: Router, private dialog: MatDialog, private clipboard: Clipboard) { }

  ngOnInit(): void {
    // Remove sub name as it's not necessary for one-off downloads
    if (this.uids) {
      this.displayedColumnsBig = this.displayedColumnsBig.filter(col => col !== 'select' && col !== 'sub_name');
      this.displayedColumnsSmall = this.displayedColumnsSmall.filter(col => col !== 'select');
    }
    else this.restoreViewState();
    this.innerWidth = window.innerWidth;
    this.recalculateColumns();
    if (this.postsService.initialized) {
      this.getCurrentDownloadsRecurring();
    } else {
      this.initialization_subscription = this.postsService.service_initialized.subscribe(init => {
        if (init) {
          this.initialization_subscription?.unsubscribe();
          this.initialization_subscription = null;
          this.getCurrentDownloadsRecurring();
        }
      });
    }
  }

  getCurrentDownloadsRecurring(): void {
    if (!this.postsService.config['Extra']['enable_downloads_manager']) {
      this.router.navigate(['/home']);
      return;
    }
    this.polling_stopped = false;
    this.pollCurrentDownloads();
  }

  ngOnDestroy(): void {
    this.polling_stopped = true;
    this.initialization_subscription?.unsubscribe();
    this.downloads_request_subscription?.unsubscribe();
    this.downloads_request_subscription = null;
    this.downloads_request_in_flight = false;
    if (this.interval_id) { clearTimeout(this.interval_id) }
  }

  pollCurrentDownloads(): void {
    this.getCurrentDownloads(true);
  }

  getCurrentDownloads(scheduleNextPoll = false): void {
    if (this.downloads_request_in_flight) return;

    this.downloads_request_in_flight = true;
    const requestSubscription = this.postsService.getCurrentDownloads(this.uids).subscribe(res => {
      if (res['downloads'] !== null 
        && res['downloads'] !== undefined) {
          this.downloads_connection_error = false;
          this.consecutive_poll_failures = 0;
          if (JSON.stringify(this.downloads) !== JSON.stringify(res['downloads'])) {
            this.downloads = this.combineDownloads(this.downloads, res['downloads']);
            this.downloads.sort(this.sort_downloads);
            this.pruneSelection();
            this.configureDataSource();
            this.updateDownloadAvailability();
          }
      } else {
        this.markDownloadsRefreshFailed();
      }
      this.downloads_retrieved = true;
    }, () => {
      this.markDownloadsRefreshFailed();
      this.downloads_retrieved = true;
      this.finishDownloadsRequest(scheduleNextPoll);
    }, () => {
      this.finishDownloadsRequest(scheduleNextPoll);
    });
    this.downloads_request_subscription = requestSubscription.closed ? null : requestSubscription;
  }

  markDownloadsRefreshFailed(): void {
    this.downloads_connection_error = true;
    this.consecutive_poll_failures += 1;
  }

  finishDownloadsRequest(scheduleNextPoll: boolean): void {
    this.downloads_request_subscription = null;
    this.downloads_request_in_flight = false;
    if (scheduleNextPoll && !this.polling_stopped) {
      this.interval_id = setTimeout(() => this.pollCurrentDownloads(), this.getNextPollDelay());
    }
  }

  getNextPollDelay(): number {
    if (!this.downloads_connection_error) return this.downloads_check_interval;
    const backoffMultiplier = Math.pow(2, Math.min(this.consecutive_poll_failures, 5));
    return Math.min(this.downloads_check_interval * backoffMultiplier, 30000);
  }

  configureDataSource(): void {
    this.dataSource = new MatTableDataSource<Download>(this.downloads);
    this.dataSource.filterPredicate = (download: Download, serializedFilter: string): boolean => {
      const filter = JSON.parse(serializedFilter);
      const searchableText = `${download.title || ''} ${download.sub_name || ''}`.toLocaleLowerCase();
      const matchesSearch = !filter.search || searchableText.includes(filter.search);
      const matchesStatus = filter.status === 'all' || this.getDownloadStatus(download) === filter.status;
      return matchesSearch && matchesStatus;
    };
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.applyFilters(false);
  }

  updateSearch(value: string): void {
    this.searchTerm = value || '';
    this.applyFilters();
  }

  updateStatusFilter(value: string): void {
    this.statusFilter = this.isValidStatusFilter(value) ? value : 'all';
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.statusFilter = 'all';
    this.applyFilters();
  }

  applyFilters(resetPage = true): void {
    if (this.uids) return;
    this.persistViewState();
    if (!this.dataSource) return;
    this.dataSource.filter = JSON.stringify({
      search: this.searchTerm.trim().toLocaleLowerCase(),
      status: this.statusFilter
    });
    if (resetPage) this.dataSource.paginator?.firstPage();
  }

  getDownloadStatus(download: Download): string {
    if (download.error) return 'failed';
    if (download.cancelled) return 'cancelled';
    if (download.paused && !download.finished) return 'paused';
    if (download.finished || download.step_index === 3) return 'completed';
    if (download.step_index === 0) return 'queued';
    return 'active';
  }

  hasActiveFilters(): boolean {
    return this.searchTerm.trim() !== '' || this.statusFilter !== 'all';
  }

  private restoreViewState(): void {
    try {
      const storedState = JSON.parse(localStorage.getItem(this.downloadsViewStateKey));
      this.searchTerm = typeof storedState?.search === 'string' ? storedState.search : '';
      this.statusFilter = this.isValidStatusFilter(storedState?.status) ? storedState.status : 'all';
    } catch (_) {
      this.searchTerm = '';
      this.statusFilter = 'all';
    }
  }

  private persistViewState(): void {
    localStorage.setItem(this.downloadsViewStateKey, JSON.stringify({
      search: this.searchTerm,
      status: this.statusFilter
    }));
  }

  private isValidStatusFilter(value: string): boolean {
    return this.statusFilterOptions.some(option => option.value === value);
  }

  isDownloadSelected(download: Download): boolean {
    return this.selectedDownloadUids.has(download.uid);
  }

  toggleDownloadSelection(download: Download): void {
    if (this.isDownloadSelected(download)) this.selectedDownloadUids.delete(download.uid);
    else this.selectedDownloadUids.add(download.uid);
  }

  allFilteredDownloadsSelected(): boolean {
    return !!this.dataSource?.filteredData.length
      && this.dataSource.filteredData.every(download => this.selectedDownloadUids.has(download.uid));
  }

  someFilteredDownloadsSelected(): boolean {
    if (!this.dataSource?.filteredData.length) return false;
    const selectedCount = this.dataSource.filteredData.filter(download => this.selectedDownloadUids.has(download.uid)).length;
    return selectedCount > 0 && selectedCount < this.dataSource.filteredData.length;
  }

  toggleFilteredDownloadsSelection(): void {
    if (!this.dataSource?.filteredData.length) return;
    if (this.allFilteredDownloadsSelected()) {
      this.dataSource.filteredData.forEach(download => this.selectedDownloadUids.delete(download.uid));
    } else {
      this.dataSource.filteredData.forEach(download => this.selectedDownloadUids.add(download.uid));
    }
  }

  clearSelection(): void {
    this.selectedDownloadUids.clear();
  }

  getSelectedClearableDownloads(): Download[] {
    return this.downloads.filter(download =>
      this.selectedDownloadUids.has(download.uid) && (download.finished || download.paused)
    );
  }

  clearSelectedDownloads(): void {
    const selectedDownloads = this.getSelectedClearableDownloads();
    if (!selectedDownloads.length || this.bulkActionInProgress) return;
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        dialogTitle: $localize`:Bulk clear downloads confirmation title@@downloads-bulk-clear-title:Clear selected downloads?`,
        dialogText: $localize`:Bulk clear downloads confirmation text@@downloads-bulk-clear-description:Only selected completed or paused entries will be removed. Active downloads are kept.`,
        submitText: $localize`:Bulk clear downloads confirmation action@@downloads-bulk-clear-confirm:Clear selected`,
        warnSubmitColor: true
      }
    });
    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.bulkActionInProgress = true;
      const requests = selectedDownloads.map(download =>
        this.postsService.clearDownload(download.uid).pipe(catchError(() => of({success: false})))
      );
      forkJoin(requests).subscribe(results => {
        const clearedUids = selectedDownloads
          .filter((_, index) => results[index]['success'])
          .map(download => download.uid);
        clearedUids.forEach(uid => this.selectedDownloadUids.delete(uid));
        if (clearedUids.length) {
          this.downloads = this.downloads.filter(download => !clearedUids.includes(download.uid));
          this.configureDataSource();
          this.updateDownloadAvailability();
        }
        const failedCount = results.length - clearedUids.length;
        if (failedCount) {
          this.postsService.openSnackBar($localize`:Bulk clear downloads failure@@downloads-bulk-clear-failed:Some selected downloads could not be cleared. Try again.`);
        } else {
          this.postsService.openSnackBar($localize`:Bulk clear downloads success@@downloads-bulk-clear-success:Selected downloads cleared.`);
        }
        this.bulkActionInProgress = false;
      });
    });
  }

  private pruneSelection(): void {
    const currentUids = new Set(this.downloads.map(download => download.uid));
    Array.from(this.selectedDownloadUids).forEach(uid => {
      if (!currentUids.has(uid)) this.selectedDownloadUids.delete(uid);
    });
  }

  private updateDownloadAvailability(): void {
    this.paused_download_exists = this.downloads.some(download => download['paused'] && !download['error']);
    this.running_download_exists = this.downloads.some(download => !download['paused'] && !download['finished']);
    this.completed_download_exists = this.downloads.some(download => download['finished'] && !download['error'] && !download['cancelled']);
  }

  clearDownloadsByType(): void {
    const clearEmitter = new EventEmitter<boolean>();
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        dialogType: 'selection_list',
        dialogTitle: $localize`Clear downloads`,
        dialogText: $localize`Select downloads to clear`,
        submitText: $localize`Clear`,
        doneEmitter: clearEmitter,
        warnSubmitColor: true,
        list: [
          {
            title: $localize`Finished downloads`,
            key: 'clear_finished'
          },
          {
            title: $localize`Paused downloads`,
            key: 'clear_paused'
          },
          {
            title: $localize`Errored downloads`,
            key: 'clear_errors'
          }
        ]
      }
    });
    clearEmitter.subscribe((done: boolean) => {
      if (done) {
        const selected_items = dialogRef.componentInstance.selected_items;
        this.postsService.clearDownloads(selected_items.includes('clear_finished'), selected_items.includes('clear_paused'), selected_items.includes('clear_errors')).subscribe(res => {
          if (!res['success']) {
            this.postsService.openSnackBar($localize`Failed to clear finished downloads!`);
          } else {
            this.postsService.openSnackBar($localize`Cleared downloads!`);
            dialogRef.close();
          }
        });
      }
    });
  }

  clearCompletedDownloads(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        dialogTitle: $localize`:Clear completed downloads confirmation title@@downloads-clear-completed-title:Clear completed downloads?`,
        dialogText: $localize`:Clear completed downloads confirmation text@@downloads-clear-completed-description:This removes completed entries from the Downloads list. Failed, cancelled, paused, and active downloads are kept.`,
        submitText: $localize`:Clear completed downloads confirmation action@@downloads-clear-completed-confirm:Clear completed`,
        warnSubmitColor: true
      }
    });
    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.postsService.clearCompletedDownloads().subscribe(res => {
        if (res['success']) {
          this.postsService.openSnackBar($localize`:Clear completed downloads success@@downloads-clear-completed-success:Completed downloads cleared.`);
          this.getCurrentDownloads();
        } else {
          this.postsService.openSnackBar($localize`:Clear completed downloads failure@@downloads-clear-completed-failed:Could not clear completed downloads. Try again.`);
        }
      }, () => {
        this.postsService.openSnackBar($localize`:Clear completed downloads failure@@downloads-clear-completed-failed:Could not clear completed downloads. Try again.`);
      });
    });
  }

  pauseDownload(download: Download): void {
    this.postsService.pauseDownload(download['uid']).subscribe(res => {
      if (!res['success']) {
        this.postsService.openSnackBar($localize`Failed to pause download! See server logs for more info.`);
      }
    });
  }

  pauseAllDownloads(): void {
    this.postsService.pauseAllDownloads().subscribe(res => {
      if (!res['success']) {
        this.postsService.openSnackBar($localize`Failed to pause all downloads! See server logs for more info.`);
      }
    });
  }

  resumeDownload(download: Download): void {
    this.postsService.resumeDownload(download['uid']).subscribe(res => {
      if (!res['success']) {
        this.postsService.openSnackBar($localize`Failed to resume download! See server logs for more info.`);
      }
    });
  }

  resumeAllDownloads(): void {
    this.postsService.resumeAllDownloads().subscribe(res => {
      if (!res['success']) {
        this.postsService.openSnackBar($localize`Failed to resume all downloads! See server logs for more info.`);
      }
    });
  }

  restartDownload(download: Download): void {
    this.postsService.restartDownload(download['uid']).subscribe(res => {
      if (!res['success']) {
        this.postsService.openSnackBar($localize`Failed to restart download! See server logs for more info.`);
      } else {
        if (this.uids && res['new_download_uid']) {
          this.uids.push(res['new_download_uid']);
        }
      }
    });
  }

  cancelDownload(download: Download): void {
    this.postsService.cancelDownload(download['uid']).subscribe(res => {
      if (!res['success']) {
        this.postsService.openSnackBar($localize`Failed to cancel download! See server logs for more info.`);
      }
    });
  }

  clearDownload(download: Download): void {
    this.postsService.clearDownload(download['uid']).subscribe(res => {
      if (!res['success']) {
        this.postsService.openSnackBar($localize`Failed to pause download! See server logs for more info.`);
      }
    });
  }

  watchContent(download: Download): void {
    const container = download['container'];
    localStorage.setItem('player_navigator', this.router.url.split(';')[0]);
    const is_playlist = container['uids']; // hacky, TODO: fix
    if (is_playlist) {
      this.router.navigate(['/player', {playlist_id: container['id'], type: download['type']}]);
    } else {
      this.router.navigate(['/player', {type: download['type'], uid: container['uid']}]);
    }
  }

  combineDownloads(downloads_old: Download[], downloads_new: Download[]): Download[] {
    // only keeps downloads that exist in the new set
    downloads_old = downloads_old.filter(download_old => downloads_new.some(download_new => download_new.uid === download_old.uid));

    // add downloads from the new set that the old one doesn't have
    const downloads_to_add = downloads_new.filter(download_new => !downloads_old.some(download_old => download_new.uid === download_old.uid));
    downloads_old.push(...downloads_to_add);
    downloads_old.forEach(download_old => {
      const download_new = downloads_new.find(download_to_check => download_old.uid === download_to_check.uid);
      Object.keys(download_new).forEach(key => {
        download_old[key] = download_new[key];
      });
  
      Object.keys(download_old).forEach(key => {
        if (!(key in download_new)) delete download_old[key];
      });
    });

    return downloads_old;
  }

  showError(download: Download): void {
    const copyToClipboardEmitter = new EventEmitter<boolean>();
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        dialogTitle: $localize`Error for ${download['url']}:url:`,
        dialogText: download['error'],
        submitText: $localize`Copy to clipboard`,
        cancelText: $localize`Close`,
        closeOnSubmit: false,
        onlyEmitOnDone: true,
        doneEmitter: copyToClipboardEmitter
      }
    });
    copyToClipboardEmitter.subscribe(done => {
      if (done) {
        this.postsService.openSnackBar($localize`Copied to clipboard!`);
        this.clipboard.copy(download['error']);
      }
    });
  }

  recalculateColumns() {
    if (this.innerWidth < 650) this.displayedColumns = this.displayedColumnsSmall;
    else                       this.displayedColumns = this.displayedColumnsBig;

    this.actionsFlex = this.uids || this.innerWidth < 800 ? 1 : 2;

    if (this.innerWidth < 800 && !this.uids || this.innerWidth < 1100 && this.uids) this.minimizeButtons = true;
    else                                                                            this.minimizeButtons = false;
  }
}

interface DownloadAction {
  tooltip: string,
  action: (download: Download) => void,
  show: (download: Download) => boolean,
  icon: string,
  loading?: (download: Download) => boolean
}
