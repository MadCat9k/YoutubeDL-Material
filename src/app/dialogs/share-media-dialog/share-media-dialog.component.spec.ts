import { of, Subject, throwError } from 'rxjs';

import { PostsService } from 'app/posts.services';
import { ShareMediaDialogComponent } from './share-media-dialog.component';

describe('ShareMediaDialogComponent', () => {
  let component: ShareMediaDialogComponent;
  let postsService: jasmine.SpyObj<PostsService>;

  beforeEach(() => {
    postsService = jasmine.createSpyObj<PostsService>('PostsService', [
      'enableSharing',
      'disableSharing',
      'openSnackBar'
    ]);
    component = new ShareMediaDialogComponent(
      {uid: 'synthetic-file', current_timestamp: 0},
      {} as any,
      {} as any,
      postsService
    );
    component.uid = 'synthetic-file';
    component.is_playlist = false;
    component.sharing_enabled = false;
  });

  afterEach(() => component.ngOnDestroy());

  it('confirms sharing only after success and prevents overlapping requests', () => {
    const response = new Subject<any>();
    const firstEvent = createSharingEvent(true);
    const overlappingEvent = createSharingEvent(false);
    postsService.enableSharing.and.returnValue(response);

    component.sharingChanged(firstEvent);
    component.sharingChanged(overlappingEvent);

    expect(postsService.enableSharing).toHaveBeenCalledTimes(1);
    expect(postsService.disableSharing).not.toHaveBeenCalled();
    expect(component.sharing_enabled).toBe(false);
    expect(component.sharingPending).toBe(true);
    expect(overlappingEvent.source.checked).toBe(false);

    response.next({success: true});
    response.complete();

    expect(component.sharing_enabled).toBe(true);
    expect(component.sharingPending).toBe(false);
    expect(firstEvent.source.checked).toBe(true);
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Sharing enabled.');
  });

  it('disables sharing only after a confirmed response', () => {
    component.sharing_enabled = true;
    postsService.disableSharing.and.returnValue(of({success: true}));

    component.sharingChanged(createSharingEvent(false));

    expect(component.sharing_enabled).toBe(false);
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Sharing disabled.');
  });

  it('restores the checkbox and remains retryable after rejected and failed requests', () => {
    const rejectedEvent = createSharingEvent(true);
    const failedEvent = createSharingEvent(true);
    postsService.enableSharing.and.returnValues(
      of({success: false}),
      throwError(() => new Error('synthetic sharing failure'))
    );

    component.sharingChanged(rejectedEvent);
    component.sharingChanged(failedEvent);

    expect(postsService.enableSharing).toHaveBeenCalledTimes(2);
    expect(component.sharing_enabled).toBe(false);
    expect(component.sharingPending).toBe(false);
    expect(rejectedEvent.source.checked).toBe(false);
    expect(failedEvent.source.checked).toBe(false);
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Failed to enable sharing.');
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Failed to enable sharing - server error.');
  });

  it('cancels an active sharing request when the dialog closes', () => {
    const response = new Subject<any>();
    postsService.enableSharing.and.returnValue(response);
    component.sharingChanged(createSharingEvent(true));

    component.ngOnDestroy();
    response.next({success: true});

    expect(response.observers.length).toBe(0);
    expect(component.sharingRequest).toBeNull();
    expect(component.sharingPending).toBe(false);
    expect(component.sharing_enabled).toBe(false);
    expect(postsService.openSnackBar).not.toHaveBeenCalled();
  });

  function createSharingEvent(checked: boolean): any {
    return {checked, source: {checked}};
  }
});
