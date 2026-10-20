import { of } from 'rxjs';

import { UpdateTaskScheduleDialogComponent } from './update-task-schedule-dialog.component';

describe('UpdateTaskScheduleDialogComponent', () => {
  let component: UpdateTaskScheduleDialogComponent;
  let dialogRef: jasmine.SpyObj<any>;
  let postsService: jasmine.SpyObj<any>;

  beforeEach(() => {
    const task = {key: 'synthetic-task', schedule: null} as any;
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    postsService = jasmine.createSpyObj('PostsService', ['getTask', 'openSnackBar']);
    postsService.getTask.and.returnValue(of({task}));
    component = new UpdateTaskScheduleDialogComponent(
      {task},
      dialogRef,
      postsService
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('provides full localized names for every weekday toggle', () => {
    expect(component.weekdayOptions.map(weekday => weekday.value)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(component.weekdayOptions.every(weekday => !!weekday.shortLabel && !!weekday.label)).toBe(true);
    expect(new Set(component.weekdayOptions.map(weekday => weekday.label)).size).toBe(7);
  });

  it('asks for a date instead of failing a one-time schedule without one', () => {
    component.enabled = true;
    component.recurring = false;
    component.time = '12:30';
    component.date = null;

    component.updateTaskSchedule();

    expect(postsService.openSnackBar).toHaveBeenCalledWith('Choose a date');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
