import { of } from 'rxjs';

import { UpdateTaskScheduleDialogComponent } from './update-task-schedule-dialog.component';

describe('UpdateTaskScheduleDialogComponent', () => {
  let component: UpdateTaskScheduleDialogComponent;

  beforeEach(() => {
    const task = {key: 'synthetic-task', schedule: null} as any;
    component = new UpdateTaskScheduleDialogComponent(
      {task},
      {} as any,
      {getTask: () => of({task})} as any
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
});
