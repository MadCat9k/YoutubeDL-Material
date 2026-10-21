import { of, Subject, throwError } from 'rxjs';

import { RestoreDbDialogComponent } from './restore-db-dialog.component';

describe('RestoreDbDialogComponent', () => {
  let component: RestoreDbDialogComponent;
  let dialogRef: jasmine.SpyObj<any>;
  let postsService: jasmine.SpyObj<any>;

  beforeEach(() => {
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    postsService = jasmine.createSpyObj('PostsService', ['getDBBackups', 'restoreDBBackup', 'openSnackBar']);
    postsService.getDBBackups.and.returnValue(of({ db_backups: [] }));

    component = new RestoreDbDialogComponent({}, dialogRef, postsService);
  });

  it('does not start a restore without exactly one selected backup', () => {
    component.restoreClicked();

    expect(postsService.restoreDBBackup).not.toHaveBeenCalled();
    expect(component.restoring).toBeFalse();
    expect(dialogRef.disableClose).not.toBeTrue();
  });

  it('closes after the server confirms the restore', () => {
    component.selected_backup = ['synthetic-backup.json'];
    postsService.restoreDBBackup.and.returnValue(of({ success: true }));

    component.restoreClicked();

    expect(postsService.restoreDBBackup).toHaveBeenCalledWith('synthetic-backup.json');
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Database successfully restored!');
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('stays open and allows retry after a rejected restore', () => {
    component.selected_backup = ['synthetic-backup.json'];
    postsService.restoreDBBackup.and.returnValue(of({ success: false }));

    component.restoreClicked();

    expect(component.restoring).toBeFalse();
    expect(dialogRef.disableClose).toBeFalse();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Database restore failed. Try again.', 'Dismiss');
  });

  it('stays open and allows retry after a request failure', () => {
    component.selected_backup = ['synthetic-backup.json'];
    postsService.restoreDBBackup.and.returnValue(throwError(() => new Error('synthetic failure')));

    component.restoreClicked();

    expect(component.restoring).toBeFalse();
    expect(dialogRef.disableClose).toBeFalse();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Database restore failed. Try again.', 'Dismiss');
  });

  it('does not start a second restore while one is pending', () => {
    const response = new Subject<any>();
    component.selected_backup = ['synthetic-backup.json'];
    postsService.restoreDBBackup.and.returnValue(response);

    component.restoreClicked();
    component.restoreClicked();

    expect(postsService.restoreDBBackup).toHaveBeenCalledTimes(1);
    expect(component.restoring).toBeTrue();
    expect(dialogRef.disableClose).toBeTrue();
  });

  it('ignores a pending backup list after the dialog is destroyed', () => {
    const response = new Subject<any>();
    postsService.getDBBackups.and.returnValue(response);
    const pendingComponent = new RestoreDbDialogComponent({}, dialogRef, postsService);

    pendingComponent.ngOnDestroy();
    response.next({ db_backups: [{ name: 'synthetic-backup.json' }] });

    expect(pendingComponent.db_backups).toEqual([]);
  });

  it('ignores a pending result after the dialog is destroyed', () => {
    const response = new Subject<any>();
    component.selected_backup = ['synthetic-backup.json'];
    postsService.restoreDBBackup.and.returnValue(response);

    component.restoreClicked();
    component.ngOnDestroy();
    response.next({ success: true });

    expect(postsService.openSnackBar).not.toHaveBeenCalled();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
