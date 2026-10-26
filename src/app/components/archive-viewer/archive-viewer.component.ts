import { SelectionModel } from '@angular/cdk/collections';
import { Component, OnDestroy, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { FileType } from 'api-types';
import { Archive } from 'api-types/models/Archive';
import { ConfirmDialogComponent } from 'app/dialogs/confirm-dialog/confirm-dialog.component';
import { PostsService } from 'app/posts.services';
import { NgxFileDropEntry } from 'ngx-file-drop';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-archive-viewer',
  templateUrl: './archive-viewer.component.html',
  styleUrls: ['./archive-viewer.component.scss']
})
export class ArchiveViewerComponent implements OnDestroy {
  readonly uploadLabel = $localize`:|Upload:Upload`;

  // table
  displayedColumns: string[] = ['select', 'timestamp', 'title', 'id', 'extractor'];
  dataSource = null;
  selection = new SelectionModel<Archive>(true, []);

  // general
  archives = null;
  archives_retrieved = false;
  text_filter = '';
  sub_id = 'none';
  upload_sub_id = 'none';
  type: FileType | 'both' = 'both';
  upload_type: FileType = FileType.VIDEO;

  // importing
  uploading_archive = false;
  uploaded_archive = false;
  downloading_archive = false;
  files = [];
  delete_confirmation_open = false;
  deleting_archives = false;

  private destroyed = new Subject<void>();
  private archive_import_id = 0;

  typeSelectOptions = {
    video: {
      key: 'video',
      label: $localize`Video`
    },
    audio: {
      key: 'audio',
      label: $localize`Audio`
    }
  };

  @ViewChild(MatSort) sort: MatSort;
  
  constructor(public postsService: PostsService, private dialog: MatDialog) {

  }

  ngOnInit() {
    this.getArchives();
  }

  ngOnDestroy(): void {
    this.archive_import_id++;
    this.uploading_archive = false;
    this.destroyed.next();
    this.destroyed.complete();
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  /** Whether the number of selected elements matches the total number of rows. */
  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  /** Selects all rows if they are not all selected; otherwise clear selection. */
  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
      return;
    }

    this.selection.select(...this.dataSource.data);
  }

  typeFilterSelectionChanged(value): void {
    this.type = value;
    this.dataSource.filter = '';
    this.text_filter = '';
    this.getArchives();
  }

  subFilterSelectionChanged(value): void {
    this.sub_id = value;
    this.dataSource.filter = '';
    this.text_filter = '';
    if (this.sub_id !== 'none') {
      this.type = this.postsService.getSubscriptionByID(this.sub_id)['type'];
    }
    this.getArchives();
  }

  subUploadFilterSelectionChanged(value): void {
    this.upload_sub_id = value;
    if (this.upload_sub_id !== 'none') {
      this.upload_type = this.postsService.getSubscriptionByID(this.upload_sub_id)['type'];
    }
  }

  getArchives(): void {
    this.postsService.getArchives(this.type === 'both' ? null : this.type, this.sub_id === 'none' ? null : this.sub_id).subscribe(res => {
      if (res['archives'] !== null 
        && res['archives'] !== undefined
        && JSON.stringify(this.archives) !== JSON.stringify(res['archives'])) {
          this.archives = res['archives']
          this.dataSource = new MatTableDataSource<Archive>(this.archives);
          this.dataSource.sort = this.sort;
      } else {
        // failed to get downloads
      }
    });
  }

  importArchive(): void {
    if (this.uploading_archive || this.uploaded_archive || this.files.length === 0) return;

    const droppedFile = this.files[0];
    if (!droppedFile.fileEntry.isFile) {
      this.showArchiveImportFailure();
      return;
    }

    this.uploading_archive = true;
    const importId = ++this.archive_import_id;
    const uploadType = this.upload_type;
    const uploadSubId = this.upload_sub_id === 'none' ? null : this.upload_sub_id;
    const fileEntry = droppedFile.fileEntry as FileSystemFileEntry;
    fileEntry.file(
      (file: File) => this.readArchiveFile(file, uploadType, uploadSubId, importId),
      () => this.finishArchiveImportFailure(importId)
    );
  }

  archiveToBase64(file: File): Promise<string> {
    return blobToBase64(file);
  }

  private async readArchiveFile(file: File, uploadType: FileType, uploadSubId: string, importId: number): Promise<void> {
    try {
      const archiveBase64 = await this.archiveToBase64(file);
      if (importId !== this.archive_import_id) return;

      this.postsService.importArchive(archiveBase64, uploadType, uploadSubId).pipe(
        takeUntil(this.destroyed),
        finalize(() => {
          if (importId === this.archive_import_id) this.uploading_archive = false;
        })
      ).subscribe({
        next: res => {
          if (!res['success']) {
            this.showArchiveImportFailure();
            return;
          }

          this.uploaded_archive = true;
          this.postsService.openSnackBar($localize`Archive successfully imported!`);
          this.getArchives();
        },
        error: () => this.showArchiveImportFailure()
      });
    } catch (_) {
      this.finishArchiveImportFailure(importId);
    }
  }

  private finishArchiveImportFailure(importId: number): void {
    if (importId !== this.archive_import_id) return;
    this.uploading_archive = false;
    this.showArchiveImportFailure();
  }

  showArchiveImportFailure(): void {
    this.postsService.openSnackBar(
      $localize`:@@archive-import-failed:Could not import archive. Check the file and try again.`,
      $localize`Dismiss`
    );
  }

  downloadArchive(): void {
    if (this.downloading_archive || !(this.archives && this.archives.length > 0)) return;

    this.downloading_archive = true;
    const requestedType = this.type === 'both' ? null : this.type;
    const requestedSubId = this.sub_id === 'none' ? null : this.sub_id;
    this.postsService.downloadArchive(requestedType, requestedSubId).pipe(
      takeUntil(this.destroyed),
      finalize(() => this.downloading_archive = false)
    ).subscribe({
      next: res => {
        try {
          this.saveArchive(res as Blob);
          this.postsService.openSnackBar($localize`:@@archive-download-success:Archive download started.`);
        } catch (_) {
          this.showArchiveDownloadFailure();
        }
      },
      error: () => this.showArchiveDownloadFailure()
    });
  }

  saveArchive(blob: Blob): void {
    saveAs(blob, 'archive.txt');
  }

  showArchiveDownloadFailure(): void {
    this.postsService.openSnackBar(
      $localize`:@@archive-download-failed:Could not download archive. Try again.`,
      $localize`Dismiss`
    );
  }

  openDeleteSelectedArchivesDialog(): void {
    if (this.delete_confirmation_open || this.deleting_archives || !this.selection.hasValue()) return;

    const selectedArchives = [...this.selection.selected];
    this.delete_confirmation_open = true;
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        dialogTitle: $localize`Delete archives`,
        dialogText: $localize`Would you like to delete ${this.selection.selected.length}:selected archives amount: archive(s)?`,
        submitText: $localize`Delete`,
        warnSubmitColor: true
      }
    });
    dialogRef.afterClosed().pipe(
      takeUntil(this.destroyed),
      finalize(() => this.delete_confirmation_open = false)
    ).subscribe(confirmed => {
      if (confirmed) {
        this.deleteSelectedArchives(selectedArchives);
      }
    });
  }

  deleteSelectedArchives(selectedArchives = [...this.selection.selected]): void {
    if (this.deleting_archives || selectedArchives.length === 0) return;

    this.deleting_archives = true;
    this.postsService.deleteArchiveItems(selectedArchives).pipe(
      takeUntil(this.destroyed),
      finalize(() => this.deleting_archives = false)
    ).subscribe({
      next: res => {
        if (!res['success']) {
          this.showArchiveDeleteFailure();
          return;
        }

        this.archives = (this.archives || []).filter((archive: Archive) =>
          !selectedArchives.some(selected => selected.extractor === archive.extractor && selected.id === archive.id)
        );
        if (this.dataSource) this.dataSource.data = this.archives;
        this.selection.clear();
        this.postsService.openSnackBar($localize`Successfully deleted archive items!`);
      },
      error: () => this.showArchiveDeleteFailure()
    });
  }

  showArchiveDeleteFailure(): void {
    this.postsService.openSnackBar(
      $localize`:@@archive-delete-failed:Could not delete archive items. Try again.`,
      $localize`Dismiss`
    );
  }

  public dropped(files: NgxFileDropEntry[]) {
    if (this.uploading_archive) return;

    this.archive_import_id++;
    this.files = files.slice(0, 1);
    this.uploading_archive = false;
    this.uploaded_archive = false;
  }

  originalOrder = (): number => {
    return 0;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
