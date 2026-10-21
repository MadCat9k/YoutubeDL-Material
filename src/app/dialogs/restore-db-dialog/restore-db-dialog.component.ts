import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { PostsService } from 'app/posts.services';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-restore-db-dialog',
  templateUrl: './restore-db-dialog.component.html',
  styleUrls: ['./restore-db-dialog.component.scss']
})
export class RestoreDbDialogComponent implements OnInit, OnDestroy {

  db_backups = [];
  selected_backup = null;
  restoring = false;
  private destroyed = new Subject<void>();

  constructor(@Inject(MAT_DIALOG_DATA) public data: any, private dialogRef: MatDialogRef<RestoreDbDialogComponent>, private postsService: PostsService) {
    if (this.data?.db_backups) {
      this.db_backups = this.data.db_backups;
    }

    this.getDBBackups();
  }

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  getDBBackups(): void {
    this.postsService.getDBBackups().pipe(takeUntil(this.destroyed)).subscribe(res => {
      this.db_backups = res['db_backups'];
    });
  }

  restoreClicked(): void {
    if (this.restoring || !this.selected_backup || this.selected_backup.length !== 1) return;

    this.restoring = true;
    this.dialogRef.disableClose = true;
    this.postsService.restoreDBBackup(this.selected_backup[0]).pipe(takeUntil(this.destroyed)).subscribe({
      next: res => {
        if (res['success']) {
          this.postsService.openSnackBar($localize`Database successfully restored!`);
          this.dialogRef.close();
          return;
        }

        this.handleRestoreFailure();
      },
      error: () => this.handleRestoreFailure()
    });
  }

  private handleRestoreFailure(): void {
    this.restoring = false;
    this.dialogRef.disableClose = false;
    this.postsService.openSnackBar(
      $localize`:@@database-restore-failed:Database restore failed. Try again.`,
      'Dismiss'
    );
  }

}
