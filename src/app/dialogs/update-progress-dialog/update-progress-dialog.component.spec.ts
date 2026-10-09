import { Subject, of, throwError } from 'rxjs';

import { PostsService } from 'app/posts.services';
import { UpdateProgressDialogComponent } from './update-progress-dialog.component';

describe('UpdateProgressDialogComponent', () => {
  let component: UpdateProgressDialogComponent;
  let postsService: jasmine.SpyObj<PostsService>;

  beforeEach(() => {
    postsService = jasmine.createSpyObj<PostsService>('PostsService', ['getUpdaterStatus', 'openSnackBar']);
    component = new UpdateProgressDialogComponent(postsService);
    component.pollingStopped = false;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not overlap update status requests', () => {
    const response = new Subject<any>();
    postsService.getUpdaterStatus.and.returnValue(response.asObservable());

    component.getUpdateProgress();
    component.getUpdateProgress();

    expect(postsService.getUpdaterStatus).toHaveBeenCalledTimes(1);

    response.next({updating: true, details: 'Synthetic update'});
    response.complete();
    component.getUpdateProgress();

    expect(postsService.getUpdaterStatus).toHaveBeenCalledTimes(2);
  });

  it('backs off after a refresh failure and recovers after success', () => {
    postsService.getUpdaterStatus.and.returnValue(throwError(() => new Error('synthetic failure')));

    component.getUpdateProgress();

    expect(component.connectionError).toBe(true);
    expect(component.getNextPollDelay()).toBe(500);

    postsService.getUpdaterStatus.and.returnValue(of({updating: true, details: 'Synthetic update'}));
    component.getUpdateProgress();

    expect(component.connectionError).toBe(false);
    expect(component.getNextPollDelay()).toBe(250);
  });

  it('stops polling after the update finishes', () => {
    spyOn(component, 'scheduleUpdatePoll');
    postsService.getUpdaterStatus.and.returnValue(of({updating: false, details: 'Synthetic completion'}));

    component.getUpdateProgress(true);

    expect(component.scheduleUpdatePoll).not.toHaveBeenCalled();
  });

  it('continues polling while the update is active', () => {
    spyOn(component, 'scheduleUpdatePoll');
    postsService.getUpdaterStatus.and.returnValue(of({updating: true, details: 'Synthetic update'}));

    component.getUpdateProgress(true);

    expect(component.scheduleUpdatePoll).toHaveBeenCalledTimes(1);
  });

  it('cancels an active status request when destroyed', () => {
    const response = new Subject<any>();
    postsService.getUpdaterStatus.and.returnValue(response.asObservable());
    component.getUpdateProgress();

    component.ngOnDestroy();

    expect(response.observers.length).toBe(0);
    expect(component.requestInFlight).toBe(false);
  });
});
