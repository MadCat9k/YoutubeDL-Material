import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { PostsService } from 'app/posts.services';
import { Router } from '@angular/router';
import { DatabaseFile, FileType, FileTypeFilter, Sort } from '../../../api-types';
import { MatPaginator } from '@angular/material/paginator';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, skip, take, takeUntil } from 'rxjs/operators';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatChipListboxChange } from '@angular/material/chips';
import { MatSelectionListChange } from '@angular/material/list';
import { LocationStrategy } from '@angular/common';

@Component({
  selector: 'app-recent-videos',
  templateUrl: './recent-videos.component.html',
  styleUrls: ['./recent-videos.component.scss']
})
export class RecentVideosComponent implements OnChanges, OnDestroy, OnInit {

  @Input() usePaginator = true;

  selectionActionLabels = {
    reverseOrder: $localize`:Reverse selection order action@@libraryReverseSelectionOrderAction:Reverse selection order`,
    removeItem: $localize`:Remove selected item action@@libraryRemoveSelectedItemAction:Remove selected item`
  };

  // File selection

  @Input() selectMode = false;
  @Input() defaultSelected: DatabaseFile[] = [];
  @Input() sub_id = null;
  @Input() customHeader = null;
  @Input() selectedIndex = 1;
  @Output() fileSelectionEmitter = new EventEmitter<{new_selection: string[], thumbnailURL: string}>();

  pageSize = 10;
  readonly pageSizeStorageKey = 'recent_videos_page_size';
  readonly supportedPageSizes = [5, 10, 25, 100, 250];
  paged_data: DatabaseFile[] = null;

  selected_data: string[] = [];
  selected_data_objs: DatabaseFile[] = [];
  reverse_order = false;

  // File listing (with cards)

  cached_file_count = 0;
  loading_files = null;

  normal_files_received = false;
  subscription_files_received = false;
  file_count = 10;
  searchChangedSubject: Subject<string> = new Subject<string>();
  downloading_content = {};
  search_mode = false;
  search_text = '';
  searchIsFocused = false;
  descendingMode = true;

  fileFilters = {
    video_only: {
      key: 'video_only',
      label: $localize`Video only`,
      incompatible: ['audio_only']
    },
    audio_only: {
      key: 'audio_only',
      label: $localize`Audio only`,
      incompatible: ['video_only']
    },
    favorited: {
      key: 'favorited',
      label: $localize`Favorited`
    },
  };

  selectedFilters = [];

  sortProperty = 'registered';
  
  playlists = null;

  private componentInitialized = false;
  private destroy$ = new Subject<void>();
  private fileRequest: Subscription = null;
  private playlistRequest: Subscription = null;
  private fileRequestGeneration = 0;
  private filterChangeTimer: number = null;

  @ViewChild('paginator') paginator: MatPaginator

  constructor(public postsService: PostsService, private router: Router, private locationStrategy: LocationStrategy) {
    // set filter property to cached value
    const cached_sort_property = localStorage.getItem('sort_property');
    if (cached_sort_property) {
      this.sortProperty = cached_sort_property;
    }

    // set file type filter to cached value
    const cached_file_filter = localStorage.getItem('file_filter');
    if (this.usePaginator && cached_file_filter) {
      this.selectedFilters = JSON.parse(cached_file_filter)
    } else {
      this.selectedFilters = [];
    }

    const sort_order = localStorage.getItem('recent_videos_sort_order');

    if (sort_order) {
      this.descendingMode = sort_order === 'descending';
    }

    const cachedPageSize = Number(localStorage.getItem(this.pageSizeStorageKey));
    if (this.supportedPageSizes.includes(cachedPageSize)) {
      this.pageSize = cachedPageSize;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes.sub_id) {
      return;
    }

    this.resetSubscriptionState();
    if (changes.sub_id.firstChange) {
      return;
    }

    if (this.componentInitialized && this.postsService.initialized) {
      this.getAllFiles();
    }
  }

  ngOnInit(): void {
    this.componentInitialized = true;
    if (this.loading_files === null) {
      this.resetSubscriptionState();
    }

    if (this.sub_id) {
      // subscriptions can't download both audio and video (for now), so don't let users filter for these
      delete this.fileFilters['audio_only'];
      delete this.fileFilters['video_only'];
    }

    this.postsService.service_initialized.pipe(
      filter(init => init),
      take(1),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.getAllFiles();
      this.getAllPlaylists();
    });

    this.postsService.files_changed.pipe(skip(1), takeUntil(this.destroy$)).subscribe(changed => {
      if (changed) {
        this.getAllFiles();
      }
    });

    this.postsService.playlists_changed.pipe(skip(1), takeUntil(this.destroy$)).subscribe(changed => {
      if (changed) {
        this.getAllPlaylists();
      }
    });

    
    this.selected_data = this.defaultSelected.map(file => file.uid);
    this.selected_data_objs = this.defaultSelected;    

    this.searchChangedSubject
      .pipe(debounceTime(500), distinctUntilChanged(), takeUntil(this.destroy$)
      ).subscribe(model => {
        if (model.length > 0) {
          this.search_mode = true;
        } else {
          this.search_mode = false;
        }
        this.getAllFiles();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cancelPendingFileRequest();
    this.playlistRequest?.unsubscribe();
    if (this.filterChangeTimer !== null) {
      window.clearTimeout(this.filterChangeTimer);
    }
  }

  getAllPlaylists(): void {
    this.playlistRequest?.unsubscribe();
    this.playlistRequest = this.postsService.getPlaylists().subscribe(res => {
      this.playlists = res['playlists'];
    });
  }

  // search

  onSearchInputChanged(newvalue: string): void {
    this.normal_files_received = false;
    this.resetPaginator();
    this.searchChangedSubject.next(newvalue);
  }

  sortOptionChanged(value: Sort): void {
    localStorage.setItem('sort_property', value['by']);
    localStorage.setItem('recent_videos_sort_order', value['order'] === -1 ? 'descending' : 'ascending');
    this.descendingMode = value['order'] === -1;
    this.sortProperty = value['by'];
    this.resetPaginator();
    this.getAllFiles();
  }

  filterChanged(value: string): void {
    localStorage.setItem('file_filter', value);
    // wait a bit for the animation to finish
    if (this.filterChangeTimer !== null) {
      window.clearTimeout(this.filterChangeTimer);
    }
    this.filterChangeTimer = window.setTimeout(() => {
      this.filterChangeTimer = null;
      this.getAllFiles();
    }, 150);
  }

  selectedFiltersChanged(event: MatChipListboxChange): void {
    // in some cases this function will fire even if the selected filters haven't changed
    if (event.value.length === this.selectedFilters.length) return;
    if (event.value.length > this.selectedFilters.length) {
      const filter_key = event.value.filter(possible_new_key => !this.selectedFilters.includes(possible_new_key))[0];
      this.selectedFilters = this.selectedFilters.filter(existing_filter => !this.fileFilters[existing_filter].incompatible || !this.fileFilters[existing_filter].incompatible.includes(filter_key));
      this.selectedFilters.push(filter_key);
    } else {
      this.selectedFilters = event.value;
    }
    this.resetPaginator();
    this.filterChanged(JSON.stringify(this.selectedFilters));
  }

  hasActiveFilters(): boolean {
    return !!this.search_text.trim() || this.selectedFilters.length > 0;
  }

  clearFilters(): void {
    if (!this.hasActiveFilters()) return;
    const searchWasActive = !!this.search_text;
    this.search_text = '';
    this.search_mode = false;
    this.selectedFilters = [];
    localStorage.setItem('file_filter', JSON.stringify(this.selectedFilters));
    this.resetPaginator();
    if (this.filterChangeTimer !== null) {
      window.clearTimeout(this.filterChangeTimer);
      this.filterChangeTimer = null;
    }
    if (searchWasActive) {
      this.searchChangedSubject.next('');
    } else {
      this.getAllFiles();
    }
  }

  getFileTypeFilter(): string {
    if (this.selectedFilters.includes('audio_only')) {
      return 'audio_only';
    } else if (this.selectedFilters.includes('video_only')) {
      return 'video_only';
    } else {
      return 'both';
    }
  }

  getFavoriteFilter(): boolean {
    return this.selectedFilters.includes('favorited');
  }


  // get files

  getAllFiles(cache_mode = false): void {
    this.cancelPendingFileRequest();
    const requestGeneration = ++this.fileRequestGeneration;
    const requestSubId = this.sub_id;
    this.normal_files_received = cache_mode;
    const current_file_index = (this.paginator?.pageIndex ? this.paginator.pageIndex : 0)*this.pageSize;
    const sort = {by: this.sortProperty, order: this.descendingMode ? -1 : 1};
    const range = [current_file_index, current_file_index + this.pageSize];
    const fileTypeFilter = this.getFileTypeFilter();
    const favoriteFilter = this.getFavoriteFilter();
    this.fileRequest = this.postsService.getAllFiles(sort, this.usePaginator ? range : null, this.search_mode ? this.search_text : null, fileTypeFilter as FileTypeFilter, favoriteFilter, requestSubId).subscribe(res => {
      if (requestGeneration !== this.fileRequestGeneration || requestSubId !== this.sub_id) {
        return;
      }
      this.file_count = res['file_count'];
      this.paged_data = res['files'];
      for (let i = 0; i < this.paged_data.length; i++) {
        const file = this.paged_data[i];
        file.duration = typeof file.duration !== 'string' ? file.duration : this.durationStringToNumber(file.duration);
      }

      // set cached file count for future use, note that we convert the amount of files to a string
      localStorage.setItem(this.getCachedFileCountKey(), '' + this.file_count);

      this.normal_files_received = true;

    });
  }

  private resetSubscriptionState(): void {
    this.cancelPendingFileRequest();
    this.fileRequestGeneration++;

    if (this.filterChangeTimer !== null) {
      window.clearTimeout(this.filterChangeTimer);
      this.filterChangeTimer = null;
    }

    if (this.paginator) {
      this.paginator.pageIndex = 0;
    }

    this.paged_data = null;
    this.file_count = 0;
    this.normal_files_received = false;
    this.subscription_files_received = false;
    this.search_mode = false;
    this.search_text = '';
    this.downloading_content = {};

    const cachedFileCount = Number(localStorage.getItem(this.getCachedFileCountKey()));
    this.cached_file_count = Number.isFinite(cachedFileCount) ? Math.min(Math.max(cachedFileCount, 0), this.pageSize) : 0;
    this.loading_files = Array(this.cached_file_count || this.pageSize).fill(0);
  }

  private cancelPendingFileRequest(): void {
    this.fileRequest?.unsubscribe();
    this.fileRequest = null;
  }

  private resetPaginator(): void {
    if (this.paginator) {
      this.paginator.pageIndex = 0;
    }
  }

  private getCachedFileCountKey(): string {
    return `cached_file_count${this.sub_id ? `_${this.sub_id}` : ''}`;
  }

  // navigation

  goToFile(info_obj) {
    const file = info_obj['file'];
    const event = info_obj['event'];
    if (this.postsService.config['Extra']['download_only_mode']) {
      this.downloadFile(file);
    } else {
      this.navigateToFile(file, event.ctrlKey || event.metaKey || event.button === 1);
    }
  }

  navigateToFile(file: DatabaseFile, new_tab: boolean): void {
    localStorage.setItem('player_navigator', this.router.url);
    const commands = ['/player', {uid: file.uid, type: file.isAudio ? 'audio' : 'video'}];
    if (new_tab) {
      const urlTree = this.router.createUrlTree(commands);
      const externalUrl = this.locationStrategy.prepareExternalUrl(this.router.serializeUrl(urlTree));
      window.open(externalUrl, '_blank', 'noopener');
    } else {
      this.router.navigate(commands);
    }
  }

  goToSubscription(file: DatabaseFile): void {
    this.router.navigate(['/subscription', {id: file.sub_id}]);
  }

  // downloading

  downloadFile(file: DatabaseFile): void {
    const type = (file.isAudio ? 'audio' : 'video') as FileType;
    const ext = type === 'audio' ? '.mp3' : '.mp4'
    const name = file.id;
    this.downloading_content[file.uid] = true;
    this.postsService.downloadFileFromServer(file.uid).subscribe(res => {
      this.downloading_content[file.uid] = false;
      const blob: Blob = res;
      saveAs(blob, decodeURIComponent(name) + ext);

      if (!this.postsService.config.Extra.file_manager_enabled && !file.sub_id) {
        // tell server to delete the file once downloaded
        this.postsService.deleteFile(file.uid).subscribe(() => {
          // reload files
          this.getAllFiles();
        });
      }
    });
  }

  // deleting

  deleteFile(args) {
    const file = args.file;
    const blacklistMode = args.blacklistMode;

    if (file.sub_id) {
      this.deleteSubscriptionFile(file, blacklistMode);
    } else {
      this.deleteNormalFile(file, blacklistMode);
    }
  }

  deleteNormalFile(file: DatabaseFile, blacklistMode = false): void {
    this.postsService.deleteFile(file.uid, blacklistMode).subscribe(result => {
      if (result) {
        this.postsService.openSnackBar($localize`Delete success!`, $localize`OK.`);
        this.removeFileCard(file);
      } else {
        this.postsService.openSnackBar($localize`Delete failed!`, $localize`OK.`);
      }
    }, () => {
      this.postsService.openSnackBar($localize`Delete failed!`, $localize`OK.`);
    });
  }

  deleteSubscriptionFile(file: DatabaseFile, blacklistMode = false): void {
    if (blacklistMode) {
      this.deleteForever(file);
    } else {
      this.deleteAndRedownload(file);
    }
  }

  deleteAndRedownload(file: DatabaseFile): void {
    this.postsService.deleteSubscriptionFile(file.uid, false).subscribe(() => {
      this.postsService.openSnackBar($localize`Successfully deleted file: ` + file.id);
      this.removeFileCard(file);
    });
  }

  deleteForever(file: DatabaseFile): void {
    this.postsService.deleteSubscriptionFile(file.uid, true).subscribe(() => {
      this.postsService.openSnackBar($localize`Successfully deleted file: ` + file.id);
      this.removeFileCard(file);
    });
  }

  removeFileCard(file_to_remove: DatabaseFile): void {
    const index = this.paged_data.map(e => e.uid).indexOf(file_to_remove.uid);
    this.paged_data.splice(index, 1);
    this.getAllFiles(true);
  }

  // TODO: Add translation support for these snackbars
  addFileToPlaylist(info_obj) {
    const file = info_obj['file'];
    const playlist_id = info_obj['playlist_id'];
    const playlist = this.playlists.find(potential_playlist => potential_playlist['id'] === playlist_id);
    this.postsService.addFileToPlaylist(playlist_id, file['uid']).subscribe(res => {
      if (res['success']) {
        this.postsService.openSnackBar(`Successfully added ${file.title} to ${playlist.title}!`);
        this.postsService.playlists_changed.next(true);
      } else {
        this.postsService.openSnackBar(`Failed to add ${file.title} to ${playlist.title}! Unknown error.`);
      }
    }, err => {
      console.error(err);
      this.postsService.openSnackBar(`Failed to add ${file.title} to ${playlist.title}! See browser console for error.`);
    });
  }

  // sorting and filtering

  sortFiles(a: DatabaseFile, b: DatabaseFile): number {
    // uses the 'registered' flag as the timestamp
    const result = b.registered - a.registered;
    return result;
  }

  durationStringToNumber(dur_str: string): number {
    let num_sum = 0;
    const dur_str_parts = dur_str.split(':');
    for (let i = dur_str_parts.length - 1; i >= 0; i--) {
      num_sum += parseInt(dur_str_parts[i]) * (60 ** (dur_str_parts.length - 1 - i));
    }
    return num_sum;
  }

  pageChangeEvent(event) {
    this.pageSize = event.pageSize;
    if (this.supportedPageSizes.includes(this.pageSize)) {
      localStorage.setItem(this.pageSizeStorageKey, String(this.pageSize));
    }
    this.loading_files = Array(this.pageSize).fill(0);
    this.getAllFiles();
  }

  fileSelectionChanged(event: MatSelectionListChange): void {
    // TODO: make sure below line is possible (_selected is private)
    const adding = event.option['_selected'];
    const value = event.option.value;
    if (adding) {
      this.selected_data.push(value.uid);
      this.selected_data_objs.push(value);
    } else {
      this.selected_data      = this.selected_data.filter(e => e !== value.uid);
      this.selected_data_objs = this.selected_data_objs.filter(e => e.uid !== value.uid);
    }

    this.fileSelectionEmitter.emit({new_selection: this.selected_data, thumbnailURL: this.selected_data_objs[0].thumbnailURL});
  }

  toggleSelectionOrder(): void {
    this.reverse_order = !this.reverse_order;
    localStorage.setItem('default_playlist_order_reversed', '' + this.reverse_order);
  }

  drop(event: CdkDragDrop<string[]>): void {
    if (this.reverse_order) {
      event.previousIndex = this.selected_data.length - 1 - event.previousIndex;
      event.currentIndex = this.selected_data.length - 1 - event.currentIndex;
    }
    moveItemInArray(this.selected_data, event.previousIndex, event.currentIndex);
    moveItemInArray(this.selected_data_objs, event.previousIndex, event.currentIndex);
    this.fileSelectionEmitter.emit({new_selection: this.selected_data, thumbnailURL: this.selected_data_objs[0].thumbnailURL});
  }

  removeSelectedFile(index: number): void {
    if (this.reverse_order) {
      index = this.selected_data.length - 1 - index;
    }
    this.selected_data.splice(index, 1);
    this.selected_data_objs.splice(index, 1);
    this.fileSelectionEmitter.emit({new_selection: this.selected_data, thumbnailURL: this.selected_data_objs[0].thumbnailURL});
  }

  originalOrder = (): number => {
    return 0;
  }

  toggleFavorite(file_obj): void {
    file_obj.favorite = !file_obj.favorite;
    this.postsService.updateFile(file_obj.uid, {favorite: file_obj.favorite}).subscribe(res => {});
  }
}
