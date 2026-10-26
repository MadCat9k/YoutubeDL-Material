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
  files = [];
  delete_confirmation_open = false;
  deleting_archives = false;

  private destroyed = new Subject<void>();

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
    this.uploading_archive = true;
        for (const droppedFile of this.files) {
      // Is it a file?
      if (droppedFile.fileEntry.isFile) {
        const fileEntry = droppedFile.fileEntry as FileSystemFileEntry;
        fileEntry.file(async (file: File) => {          
          const archive_base64 = await blobToBase64(file);
          this.postsService.importArchive(archive_base64 as string, this.upload_type, this.upload_sub_id === 'none' ? null : this.upload_sub_id).subscribe(res => {
            this.uploading_archive = false;
            if (res['success']) {
              this.uploaded_archive = true;
              this.postsService.openSnackBar($localize`Archive successfully imported!`);
            }
            this.getArchives();
          }, err => {
            console.error(err);
            this.uploading_archive = false;
          });
        });
      }
    }
  }

  downloadArchive(): void {
    this.postsService.downloadArchive(this.type === 'both' ? null : this.type, this.sub_id === 'none' ? null : this.sub_id).subscribe(res => {
      const blob: Blob = res;
      saveAs(blob, 'archive.txt');
    });
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
    this.files = files;
    this.uploading_archive = false;
    this.uploaded_archive = false;
  }

  originalOrder = (): number => {
    return 0;
  }
}

function blobToBase64(blob: Blob) {
  return new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}
