import { Component, OnDestroy, OnInit, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { PostsService } from 'app/posts.services';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { Subscription } from 'api-types';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-subscription-info-dialog',
  templateUrl: './subscription-info-dialog.component.html',
  styleUrls: ['./subscription-info-dialog.component.scss']
})
export class SubscriptionInfoDialogComponent implements OnInit, OnDestroy {

  sub: Subscription = null;
  unsubbedEmitter = null;
  isUnsubscribing = false;
  private destroyed = new Subject<void>();

  constructor(public dialogRef: MatDialogRef<SubscriptionInfoDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any, private postsService: PostsService,
    private dialog: MatDialog) { }

  ngOnInit() {
    if (this.data) {
      this.sub = this.data.sub;
      this.unsubbedEmitter = this.data.unsubbedEmitter;
    }
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  confirmUnsubscribe() {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        dialogTitle: $localize`Unsubscribe from ${this.sub['name']}:subscription name:`,
        dialogText: $localize`Would you like to unsubscribe from ${this.sub['name']}:subscription name:?`,
        submitText: $localize`Unsubscribe`,
        warnSubmitColor: true
      }
    });
    dialogRef.afterClosed().pipe(takeUntil(this.destroyed)).subscribe(confirmed => {
      if (confirmed) {
        this.unsubscribe();
      }
    });
  }

  unsubscribe() {
    if (this.isUnsubscribing) return;

    this.isUnsubscribing = true;
    this.dialogRef.disableClose = true;
    this.postsService.unsubscribe(this.sub.id, true).pipe(takeUntil(this.destroyed)).subscribe({
      next: res => {
        if (res.success) {
          this.unsubbedEmitter.emit(true);
          this.dialogRef.close();
          return;
        }

        this.handleUnsubscribeFailure();
      },
      error: () => this.handleUnsubscribeFailure()
    });
  }

  private handleUnsubscribeFailure() {
    this.isUnsubscribing = false;
    this.dialogRef.disableClose = false;
    this.postsService.openSnackBar(
      $localize`:@@subscription-remove-failed:Subscription removal failed. Try again.`,
      'Dismiss'
    );
  }

  downloadArchive() {
    this.postsService.downloadArchive(null, this.sub.id).pipe(takeUntil(this.destroyed)).subscribe(res => {
      const blob: Blob = res;
      saveAs(blob, 'archive.txt');
    });
  }

}
