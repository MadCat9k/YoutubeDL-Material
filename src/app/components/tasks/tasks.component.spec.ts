import { Clipboard } from '@angular/cdk/clipboard';
import { MatDialog } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';

import { PostsService } from 'app/posts.services';
import { TaskType } from 'api-types';
import { TasksComponent } from './tasks.component';

describe('TasksComponent', () => {
  let component: TasksComponent;
  let postsService: jasmine.SpyObj<PostsService>;
  let dialog: jasmine.SpyObj<MatDialog>;
  const taskKey = 'synthetic-task' as any;

  beforeEach(() => {
    postsService = jasmine.createSpyObj<PostsService>('PostsService', [
      'getTasks',
      'getDBBackups',
      'runTask',
      'confirmTask',
      'updateTaskSchedule',
      'resetTasks',
      'openSnackBar'
    ]);
    postsService.getTasks.and.returnValue(of({tasks: []}));
    postsService.getDBBackups.and.returnValue(of({db_backups: []} as any));
    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    component = new TasksComponent(
      postsService,
      dialog,
      {} as Clipboard
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses the compact task layout at representative narrow widths', () => {
    [320, 375, 455, 649].forEach(viewportWidth => {
      component.updateLayout(viewportWidth);

      expect(component.compactView).withContext(`${viewportWidth}px viewport`).toBe(true);
    });
  });

  it('uses the table layout at and above the mobile breakpoint', () => {
    component.updateLayout(650);

    expect(component.compactView).toBe(false);
  });

  it('does not start another tasks request while one is in flight', () => {
    const response = new Subject<any>();
    postsService.getTasks.and.returnValue(response.asObservable());

    component.getTasks();
    component.getTasks();

    expect(postsService.getTasks).toHaveBeenCalledTimes(1);

    response.next({tasks: []});
    response.complete();
    component.getTasks();

    expect(postsService.getTasks).toHaveBeenCalledTimes(2);
  });

  it('backs off after a refresh failure and recovers after success', () => {
    postsService.getTasks.and.returnValue(throwError(() => new Error('synthetic failure')));

    component.getTasks();

    expect(component.tasks_connection_error).toBe(true);
    expect(component.consecutive_poll_failures).toBe(1);
    expect(component.getNextPollDelay()).toBe(3000);

    postsService.getTasks.and.returnValue(of({tasks: []}));
    component.getTasks();

    expect(component.tasks_connection_error).toBe(false);
    expect(component.consecutive_poll_failures).toBe(0);
    expect(component.getNextPollDelay()).toBe(1500);
  });

  it('updates the existing data source so table view state is preserved', () => {
    postsService.getTasks.and.returnValues(
      of({tasks: [{key: 'synthetic-task', title: 'First title'}]} as any),
      of({tasks: [{key: 'synthetic-task', title: 'Updated title'}]} as any)
    );

    component.getTasks();
    const originalDataSource = component.dataSource;
    component.getTasks();

    expect(component.dataSource).toBe(originalDataSource);
    expect(component.dataSource.data[0].title).toBe('Updated title');
  });

  it('cancels an in-flight tasks request when destroyed', () => {
    const response = new Subject<any>();
    postsService.getTasks.and.returnValue(response.asObservable());
    component.getTasks();

    component.ngOnDestroy();

    expect(response.observers.length).toBe(0);
    expect(component.tasks_request_in_flight).toBe(false);
  });

  it('runs a task once, refreshes task data, and announces success', () => {
    postsService.runTask.and.returnValue(of({success: true}));

    component._runTask(taskKey);

    expect(postsService.runTask).toHaveBeenCalledOnceWith(taskKey);
    expect(postsService.getTasks).toHaveBeenCalled();
    expect(postsService.getDBBackups).toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Successfully ran task!');
    expect(component.taskActionPending(taskKey)).toBeFalse();
  });

  it('allows a task run to be retried after a rejected response', () => {
    postsService.runTask.and.returnValue(of({success: false}));

    component._runTask(taskKey);
    component._runTask(taskKey);

    expect(postsService.runTask).toHaveBeenCalledTimes(2);
    expect(postsService.getTasks).not.toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not run task. Try again.',
      'Dismiss'
    );
  });

  it('allows a task run to be retried after a failed request', () => {
    postsService.runTask.and.returnValue(throwError(() => new Error('synthetic failure')));

    component._runTask(taskKey);

    expect(postsService.getTasks).not.toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not run task. Try again.',
      'Dismiss'
    );
    expect(component.taskActionPending(taskKey)).toBeFalse();
  });

  it('prevents overlapping run and confirm requests for the same task', () => {
    const response = new Subject<any>();
    postsService.runTask.and.returnValue(response);

    component._runTask(taskKey);
    component._runTask(taskKey);
    component.confirmTask(taskKey);

    expect(postsService.runTask).toHaveBeenCalledTimes(1);
    expect(postsService.confirmTask).not.toHaveBeenCalled();
    expect(component.taskActionPending(taskKey)).toBeTrue();

    response.next({success: true});
    response.complete();
    expect(component.taskActionPending(taskKey)).toBeFalse();
  });

  it('opens only one confirmation for a destructive task run', () => {
    const confirmation = new Subject<boolean>();
    const response = new Subject<any>();
    dialog.open.and.returnValue({afterClosed: () => confirmation} as any);
    postsService.runTask.and.returnValue(response);

    component.runTask(TaskType.REBUILD_DATABASE);
    component.runTask(TaskType.REBUILD_DATABASE);

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(component.taskActionPending(TaskType.REBUILD_DATABASE)).toBeTrue();

    confirmation.next(true);
    confirmation.complete();
    expect(postsService.runTask).toHaveBeenCalledOnceWith(TaskType.REBUILD_DATABASE);
    expect(component.taskActionPending(TaskType.REBUILD_DATABASE)).toBeTrue();

    response.next({success: true});
    response.complete();
    expect(component.taskActionPending(TaskType.REBUILD_DATABASE)).toBeFalse();
  });

  it('confirms a task once and announces success', () => {
    postsService.confirmTask.and.returnValue(of({success: true}));

    component.confirmTask(taskKey);

    expect(postsService.confirmTask).toHaveBeenCalledOnceWith(taskKey);
    expect(postsService.getTasks).toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Successfully confirmed task!');
  });

  it('restores confirmation after rejected and failed requests', () => {
    postsService.confirmTask.and.returnValues(
      of({success: false}),
      throwError(() => new Error('synthetic failure'))
    );

    component.confirmTask(taskKey);
    component.confirmTask(taskKey);

    expect(postsService.confirmTask).toHaveBeenCalledTimes(2);
    expect(postsService.getTasks).not.toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalledTimes(2);
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not confirm task. Try again.',
      'Dismiss'
    );
  });

  it('updates a task schedule and announces success', () => {
    const schedule = {type: 'recurring', data: {hour: 12, minute: 30}} as any;
    dialog.open.and.returnValue({afterClosed: () => of(schedule)} as any);
    postsService.updateTaskSchedule.and.returnValue(of({success: true}));

    component.scheduleTask({key: taskKey} as any);

    expect(postsService.updateTaskSchedule).toHaveBeenCalledOnceWith(taskKey, schedule);
    expect(postsService.getTasks).toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Task schedule updated.');
    expect(component.taskSchedulePending(taskKey)).toBeFalse();
  });

  it('opens only one schedule dialog for a task and restores the action after cancellation', () => {
    const dialogResult = new Subject<any>();
    dialog.open.and.returnValue({afterClosed: () => dialogResult} as any);

    component.scheduleTask({key: taskKey} as any);
    component.scheduleTask({key: taskKey} as any);

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(component.taskSchedulePending(taskKey)).toBeTrue();

    dialogResult.next(undefined);
    dialogResult.complete();
    expect(postsService.updateTaskSchedule).not.toHaveBeenCalled();
    expect(component.taskSchedulePending(taskKey)).toBeFalse();
  });

  it('allows a schedule update to be retried after rejected and failed requests', () => {
    const schedule = {type: 'recurring', data: {hour: 12, minute: 30}} as any;
    dialog.open.and.returnValue({afterClosed: () => of(schedule)} as any);
    postsService.updateTaskSchedule.and.returnValues(
      of({success: false}),
      throwError(() => new Error('synthetic failure'))
    );

    component.scheduleTask({key: taskKey} as any);
    component.scheduleTask({key: taskKey} as any);

    expect(postsService.updateTaskSchedule).toHaveBeenCalledTimes(2);
    expect(postsService.getTasks).not.toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalledTimes(2);
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not update task schedule. Try again.',
      'Dismiss'
    );
    expect(component.taskSchedulePending(taskKey)).toBeFalse();
  });

  it('does not show late schedule feedback after destruction', () => {
    const schedule = {type: 'recurring', data: {hour: 12, minute: 30}} as any;
    const response = new Subject<any>();
    dialog.open.and.returnValue({afterClosed: () => of(schedule)} as any);
    postsService.updateTaskSchedule.and.returnValue(response);

    component.scheduleTask({key: taskKey} as any);
    component.ngOnDestroy();
    response.next({success: true});

    expect(postsService.openSnackBar).not.toHaveBeenCalled();
    expect(component.taskSchedulePending(taskKey)).toBeFalse();
  });

  it('resets tasks once and refreshes task and backup data after success', () => {
    dialog.open.and.returnValue({afterClosed: () => of(true)} as any);
    postsService.resetTasks.and.returnValue(of({success: true}));

    component.resetTasks();

    expect(postsService.resetTasks).toHaveBeenCalledTimes(1);
    expect(postsService.getTasks).toHaveBeenCalled();
    expect(postsService.getDBBackups).toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Tasks successfully reset!');
    expect(component.resetting_tasks).toBeFalse();
  });

  it('restores Reset when its confirmation is cancelled', () => {
    dialog.open.and.returnValue({afterClosed: () => of(false)} as any);

    component.resetTasks();

    expect(postsService.resetTasks).not.toHaveBeenCalled();
    expect(component.resetting_tasks).toBeFalse();
  });

  it('restores Reset after a rejected response', () => {
    dialog.open.and.returnValue({afterClosed: () => of(true)} as any);
    postsService.resetTasks.and.returnValue(of({success: false}));

    component.resetTasks();

    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not reset tasks. Try again.',
      'Dismiss'
    );
    expect(component.resetting_tasks).toBeFalse();
  });

  it('prevents duplicate resets and restores the action after failure', () => {
    const response = new Subject<any>();
    dialog.open.and.returnValue({afterClosed: () => of(true)} as any);
    postsService.resetTasks.and.returnValue(response);

    component.resetTasks();
    component.resetTasks();

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(postsService.resetTasks).toHaveBeenCalledTimes(1);
    expect(component.resetting_tasks).toBeTrue();

    response.error(new Error('synthetic failure'));
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not reset tasks. Try again.',
      'Dismiss'
    );
    expect(component.resetting_tasks).toBeFalse();
  });

  it('does not show late task-action feedback after destruction', () => {
    const runResponse = new Subject<any>();
    const resetResponse = new Subject<any>();
    dialog.open.and.returnValue({afterClosed: () => of(true)} as any);
    postsService.runTask.and.returnValue(runResponse);
    postsService.resetTasks.and.returnValue(resetResponse);

    component._runTask(taskKey);
    component.resetTasks();
    component.ngOnDestroy();
    runResponse.next({success: true});
    resetResponse.next({success: true});

    expect(postsService.openSnackBar).not.toHaveBeenCalled();
    expect(component.taskActionPending(taskKey)).toBeFalse();
    expect(component.resetting_tasks).toBeFalse();
  });
});
