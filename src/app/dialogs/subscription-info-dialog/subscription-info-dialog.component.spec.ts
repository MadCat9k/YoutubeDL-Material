import { of, Subject, throwError } from 'rxjs';

import { SubscriptionInfoDialogComponent } from './subscription-info-dialog.component';

describe('SubscriptionInfoDialogComponent', () => {
  let component: SubscriptionInfoDialogComponent;
  let dialogRef: jasmine.SpyObj<any>;
  let postsService: jasmine.SpyObj<any>;
  let unsubbedEmitter: jasmine.SpyObj<any>;

  beforeEach(() => {
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    postsService = jasmine.createSpyObj('PostsService', ['downloadArchive', 'unsubscribe', 'openSnackBar']);
    unsubbedEmitter = jasmine.createSpyObj('unsubbedEmitter', ['emit']);

    component = new SubscriptionInfoDialogComponent(
      dialogRef,
      {
        sub: { id: 'synthetic-subscription-id', name: 'Synthetic subscription' },
        unsubbedEmitter
      },
      postsService,
      jasmine.createSpyObj('MatDialog', ['open'])
    );
    component.ngOnInit();
  });

  it('closes and reports completion after the server confirms removal', () => {
    postsService.unsubscribe.and.returnValue(of({ success: true }));

    component.unsubscribe();

    expect(postsService.unsubscribe).toHaveBeenCalledWith('synthetic-subscription-id', true);
    expect(unsubbedEmitter.emit).toHaveBeenCalledWith(true);
    expect(dialogRef.close).toHaveBeenCalled();
    expect(postsService.openSnackBar).not.toHaveBeenCalled();
  });

  it('stays open and reports a rejected removal', () => {
    postsService.unsubscribe.and.returnValue(of({ success: false }));

    component.unsubscribe();

    expect(component.isUnsubscribing).toBeFalse();
    expect(dialogRef.disableClose).toBeFalse();
    expect(unsubbedEmitter.emit).not.toHaveBeenCalled();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalled();
  });

  it('stays open and reports a request failure', () => {
    postsService.unsubscribe.and.returnValue(throwError(() => new Error('synthetic failure')));

    component.unsubscribe();

    expect(component.isUnsubscribing).toBeFalse();
    expect(dialogRef.disableClose).toBeFalse();
    expect(unsubbedEmitter.emit).not.toHaveBeenCalled();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalled();
  });

  it('does not start a second removal while one is pending', () => {
    const response = new Subject<any>();
    postsService.unsubscribe.and.returnValue(response);

    component.unsubscribe();
    component.unsubscribe();

    expect(postsService.unsubscribe).toHaveBeenCalledTimes(1);
    expect(component.isUnsubscribing).toBeTrue();
    expect(dialogRef.disableClose).toBeTrue();
    response.next({ success: true });
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('ignores a pending result after the dialog is destroyed', () => {
    const response = new Subject<any>();
    postsService.unsubscribe.and.returnValue(response);

    component.unsubscribe();
    component.ngOnDestroy();
    response.next({ success: true });

    expect(unsubbedEmitter.emit).not.toHaveBeenCalled();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('downloads the subscription archive and announces the result', () => {
    const archiveBlob = new Blob(['synthetic archive']);
    postsService.downloadArchive.and.returnValue(of(archiveBlob));
    spyOn(component, 'saveArchive');

    component.downloadArchive();

    expect(postsService.downloadArchive).toHaveBeenCalledOnceWith(null, 'synthetic-subscription-id');
    expect(component.saveArchive).toHaveBeenCalledOnceWith(archiveBlob);
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Archive download started.');
    expect(component.isDownloadingArchive).toBeFalse();
  });

  it('reports a failed subscription archive request and restores the action', () => {
    postsService.downloadArchive.and.returnValue(throwError(() => new Error('synthetic failure')));
    spyOn(component, 'saveArchive');

    component.downloadArchive();

    expect(component.saveArchive).not.toHaveBeenCalled();
    expect(component.isDownloadingArchive).toBeFalse();
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not download archive. Try again.',
      'Dismiss'
    );
  });

  it('reports a local subscription archive save failure', () => {
    postsService.downloadArchive.and.returnValue(of(new Blob(['synthetic archive'])));
    spyOn(component, 'saveArchive').and.throwError('synthetic save failure');

    component.downloadArchive();

    expect(component.isDownloadingArchive).toBeFalse();
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not download archive. Try again.',
      'Dismiss'
    );
  });

  it('starts only one subscription archive request while pending', () => {
    const response = new Subject<Blob>();
    postsService.downloadArchive.and.returnValue(response);

    component.downloadArchive();
    component.downloadArchive();
    component.unsubscribe();

    expect(postsService.downloadArchive).toHaveBeenCalledTimes(1);
    expect(postsService.unsubscribe).not.toHaveBeenCalled();
    expect(component.isDownloadingArchive).toBeTrue();
  });

  it('does not save or announce a late subscription archive after destruction', () => {
    const response = new Subject<Blob>();
    postsService.downloadArchive.and.returnValue(response);
    spyOn(component, 'saveArchive');

    component.downloadArchive();
    component.ngOnDestroy();
    response.next(new Blob(['synthetic archive']));

    expect(component.saveArchive).not.toHaveBeenCalled();
    expect(postsService.openSnackBar).not.toHaveBeenCalled();
    expect(component.isDownloadingArchive).toBeFalse();
  });
});
