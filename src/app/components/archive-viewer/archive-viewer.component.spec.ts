import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { of, Subject, throwError } from 'rxjs';

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
