import { Component, OnDestroy, OnInit } from '@angular/core';
import { NgxFileDropEntry, FileSystemFileEntry, FileSystemDirectoryEntry } from 'ngx-file-drop';
import { PostsService } from 'app/posts.services';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-cookies-uploader-dialog',
  templateUrl: './cookies-uploader-dialog.component.html',
  styleUrls: ['./cookies-uploader-dialog.component.scss']
})
export class CookiesUploaderDialogComponent implements OnInit, OnDestroy {
  readonly uploadLabel = $localize`:|Upload:Upload`;

  public files: NgxFileDropEntry[] = [];

  uploading = false;
  uploaded = false;
  uploadRequest: Subscription = null;
  destroyed = false;

  constructor(private postsService: PostsService) { }

  ngOnInit(): void {

  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.uploadRequest?.unsubscribe();
    this.uploadRequest = null;
    this.uploading = false;
  }

  public dropped(files: NgxFileDropEntry[]) {
    this.uploadRequest?.unsubscribe();
    this.uploadRequest = null;
    this.files = files;
    this.uploading = false;
    this.uploaded = false;
  }

  uploadFile() {
    if (this.uploading || this.uploaded) return;

    const droppedFile = this.files.find(file => file.fileEntry.isFile);
    if (!droppedFile) return;

    this.uploading = true;
    const fileEntry = droppedFile.fileEntry as FileSystemFileEntry;
    fileEntry.file((file: File) => {
      if (this.destroyed) return;

      let request: Subscription = null;
      request = this.postsService.uploadCookiesFile(file, droppedFile.relativePath)
        .pipe(finalize(() => {
          if (this.uploadRequest === request) {
            this.uploadRequest = null;
            this.uploading = false;
          }
        }))
        .subscribe({
          next: res => {
            if (!res || !res['success']) {
              this.showUploadFailure();
              return;
            }
            this.uploaded = true;
            this.postsService.openSnackBar($localize`Cookies successfully uploaded!`);
          },
          error: () => this.showUploadFailure()
        });

      if (!request.closed) {
        this.uploadRequest = request;
      } else {
        this.uploading = false;
      }
    });
  }

  private showUploadFailure(): void {
    this.uploading = false;
    this.uploaded = false;
    this.postsService.openSnackBar(
      $localize`:@@cookies-upload-failed:Could not upload cookies. Check the file and try again.`,
      $localize`Dismiss`
    );
  }

  public fileOver(event) {
  }

  public fileLeave(event) {
  }
}
