import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { of, Subject, throwError } from 'rxjs';
import { fakeAsync, flushMicrotasks } from '@angular/core/testing';

import { PostsService } from 'app/posts.services';
import { ArchiveViewerComponent } from './archive-viewer.component';

describe('ArchiveViewerComponent', () => {
  let component: ArchiveViewerComponent;
  let postsService: any;
  let dialog: jasmine.SpyObj<MatDialog>;
  const archiveA = {extractor: 'synthetic', id: 'a', title: 'Archive A'} as any;
  const archiveB = {extractor: 'synthetic', id: 'b', title: 'Archive B'} as any;

  beforeEach(() => {
    postsService = {
      deleteArchiveItems: jasmine.createSpy('deleteArchiveItems'),
      getArchives: jasmine.createSpy('getArchives').and.returnValue(of({archives: [archiveA, archiveB]})),
      importArchive: jasmine.createSpy('importArchive'),
      openSnackBar: jasmine.createSpy('openSnackBar')
    };
    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    component = new ArchiveViewerComponent(postsService as PostsService, dialog);
    component.archives = [archiveA, archiveB];
    component.dataSource = new MatTableDataSource(component.archives);
  });

  it('provides an accessible name for the archive upload action', () => {
    expect(component.uploadLabel).toBe('Upload');
  });

  it('reports a successful archive import and refreshes the archive list', fakeAsync(() => {
    const file = new File(['synthetic archive'], 'archive.txt');
    component.files = [archiveDrop(file)];
    spyOn(component, 'archiveToBase64').and.returnValue(Promise.resolve('data:text/plain;base64,c3ludGhldGlj'));
    postsService.importArchive.and.returnValue(of({success: true}));

    component.importArchive();
    flushMicrotasks();

    expect(postsService.importArchive).toHaveBeenCalledOnceWith(
      'data:text/plain;base64,c3ludGhldGlj',
      component.upload_type,
      null
    );
    expect(component.uploaded_archive).toBeTrue();
    expect(component.uploading_archive).toBeFalse();
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Archive successfully imported!');
    expect(postsService.getArchives).toHaveBeenCalled();
  }));

  it('keeps a rejected archive import available for retry', fakeAsync(() => {
    component.files = [archiveDrop(new File(['synthetic archive'], 'archive.txt'))];
    spyOn(component, 'archiveToBase64').and.returnValue(Promise.resolve('synthetic archive'));
    postsService.importArchive.and.returnValue(of({success: false}));

    component.importArchive();
    flushMicrotasks();

    expect(component.uploaded_archive).toBeFalse();
    expect(component.uploading_archive).toBeFalse();
    expect(component.files.length).toBe(1);
    expect(postsService.getArchives).not.toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not import archive. Check the file and try again.',
      'Dismiss'
    );
  }));

  it('reports a failed archive import request and restores retry controls', fakeAsync(() => {
    component.files = [archiveDrop(new File(['synthetic archive'], 'archive.txt'))];
    spyOn(component, 'archiveToBase64').and.returnValue(Promise.resolve('synthetic archive'));
    postsService.importArchive.and.returnValue(throwError(() => new Error('synthetic failure')));

    component.importArchive();
    flushMicrotasks();

    expect(component.uploaded_archive).toBeFalse();
    expect(component.uploading_archive).toBeFalse();
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not import archive. Check the file and try again.',
      'Dismiss'
    );
  }));

  it('reports a local archive read failure without starting a request', fakeAsync(() => {
    component.files = [archiveDrop(new File(['synthetic archive'], 'archive.txt'))];
    spyOn(component, 'archiveToBase64').and.returnValue(Promise.reject(new Error('synthetic read failure')));

    component.importArchive();
    flushMicrotasks();

    expect(postsService.importArchive).not.toHaveBeenCalled();
    expect(component.uploading_archive).toBeFalse();
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not import archive. Check the file and try again.',
      'Dismiss'
    );
  }));

  it('starts only one archive import while a request is pending', fakeAsync(() => {
    const response = new Subject<any>();
    component.files = [archiveDrop(new File(['synthetic archive'], 'archive.txt'))];
    spyOn(component, 'archiveToBase64').and.returnValue(Promise.resolve('synthetic archive'));
    postsService.importArchive.and.returnValue(response);

    component.importArchive();
    component.importArchive();
    flushMicrotasks();

    expect(postsService.importArchive).toHaveBeenCalledTimes(1);
    expect(component.uploading_archive).toBeTrue();
  }));

  it('does not start an archive import after destruction', fakeAsync(() => {
    component.files = [archiveDrop(new File(['synthetic archive'], 'archive.txt'))];
    spyOn(component, 'archiveToBase64').and.returnValue(Promise.resolve('synthetic archive'));

    component.importArchive();
    component.ngOnDestroy();
    flushMicrotasks();

    expect(postsService.importArchive).not.toHaveBeenCalled();
    expect(postsService.openSnackBar).not.toHaveBeenCalled();
    expect(component.uploading_archive).toBeFalse();
  }));

  it('removes only confirmed archive items after server success', () => {
    postsService.deleteArchiveItems.and.returnValue(of({success: true}));
    component.selection.select(archiveA);

    component.deleteSelectedArchives();

    expect(postsService.deleteArchiveItems).toHaveBeenCalledOnceWith([archiveA]);
    expect(component.archives).toEqual([archiveB]);
    expect(component.dataSource.data).toEqual([archiveB]);
    expect(component.selection.isEmpty()).toBeTrue();
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Successfully deleted archive items!');
    expect(component.deleting_archives).toBeFalse();
  });

  it('preserves archives and selection after a rejected deletion', () => {
    postsService.deleteArchiveItems.and.returnValue(of({success: false}));
    component.selection.select(archiveA);

    component.deleteSelectedArchives();

    expect(component.archives).toEqual([archiveA, archiveB]);
    expect(component.selection.selected).toEqual([archiveA]);
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not delete archive items. Try again.',
      'Dismiss'
    );
  });

  it('preserves archives and selection after a failed deletion request', () => {
    postsService.deleteArchiveItems.and.returnValue(throwError(() => new Error('synthetic failure')));
    component.selection.select(archiveA);

    component.deleteSelectedArchives();

    expect(component.archives).toEqual([archiveA, archiveB]);
    expect(component.selection.selected).toEqual([archiveA]);
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not delete archive items. Try again.',
      'Dismiss'
    );
    expect(component.deleting_archives).toBeFalse();
  });

  it('opens one confirmation and starts one deletion request', () => {
    const confirmation = new Subject<boolean>();
    const response = new Subject<any>();
    dialog.open.and.returnValue({afterClosed: () => confirmation} as any);
    postsService.deleteArchiveItems.and.returnValue(response);
    component.selection.select(archiveA);

    component.openDeleteSelectedArchivesDialog();
    component.openDeleteSelectedArchivesDialog();
    confirmation.next(true);
    confirmation.complete();
    component.deleteSelectedArchives();

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(postsService.deleteArchiveItems).toHaveBeenCalledTimes(1);
    expect(component.deleting_archives).toBeTrue();
  });

  it('does not show late deletion feedback after destruction', () => {
    const response = new Subject<any>();
    postsService.deleteArchiveItems.and.returnValue(response);
    component.selection.select(archiveA);

    component.deleteSelectedArchives();
    component.ngOnDestroy();
    response.next({success: true});

    expect(postsService.openSnackBar).not.toHaveBeenCalled();
    expect(component.archives).toEqual([archiveA, archiveB]);
    expect(component.deleting_archives).toBeFalse();
  });
});

function archiveDrop(file: File): any {
  return {
    fileEntry: {
      isFile: true,
      file: (success: (selectedFile: File) => void) => success(file)
    },
    relativePath: file.name
  };
}
