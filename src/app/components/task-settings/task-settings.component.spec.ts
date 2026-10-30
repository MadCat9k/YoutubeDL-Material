import { of, Subject, throwError } from 'rxjs';

import { PostsService } from 'app/posts.services';
import { TaskSettingsComponent } from './task-settings.component';

describe('TaskSettingsComponent', () => {
  let component: TaskSettingsComponent;
  let postsService: any;
  const task = {
    key: 'delete_old_files',
    title: 'Synthetic cleanup task',
    options: {auto_confirm: false, threshold_days: 30}
  } as any;

  beforeEach(() => {
    postsService = {
      getTask: jasmine.createSpy('getTask').and.returnValue(of({task: {
        ...task,
        options: {...task.options}
      }})),
      updateTaskOptions: jasmine.createSpy('updateTaskOptions'),
      openSnackBar: jasmine.createSpy('openSnackBar')
    };
    component = new TaskSettingsComponent(postsService as PostsService, {task: {
      ...task,
      options: {...task.options}
    }});
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads the current task options', () => {
    component.ngOnInit();

    expect(postsService.getTask).toHaveBeenCalledOnceWith(task.key);
    expect(component.new_options).toEqual(task.options);
    expect(component.optionsChanged()).toBeFalse();
  });

  it('saves and announces task settings', () => {
    component.new_options = {auto_confirm: true, threshold_days: 30};
    postsService.updateTaskOptions.and.returnValue(of({success: true}));

    component.saveSettings();

    expect(postsService.updateTaskOptions).toHaveBeenCalledOnceWith(task.key, {
      auto_confirm: true,
      threshold_days: 30
    });
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Task settings saved.');
    expect(component.optionsChanged()).toBeFalse();
    expect(component.saving).toBeFalse();
  });

  it('records only the submitted settings as saved', () => {
    const response = new Subject<any>();
    component.new_options = {auto_confirm: true, threshold_days: 30};
    postsService.updateTaskOptions.and.returnValue(response);

    component.saveSettings();
    component.new_options['threshold_days'] = 60;
    response.next({success: true});
    response.complete();

    expect(component.task.options).toEqual({auto_confirm: true, threshold_days: 30});
    expect(component.new_options).toEqual({auto_confirm: true, threshold_days: 60});
    expect(component.optionsChanged()).toBeTrue();
  });

  it('preserves edits and allows retry after a rejected save', () => {
    component.new_options = {auto_confirm: true, threshold_days: 30};
    postsService.updateTaskOptions.and.returnValue(of({success: false}));

    component.saveSettings();
    component.saveSettings();

    expect(postsService.updateTaskOptions).toHaveBeenCalledTimes(2);
    expect(postsService.getTask).not.toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not save task settings. Try again.',
      'Dismiss'
    );
    expect(component.optionsChanged()).toBeTrue();
  });

  it('preserves edits after a failed save request', () => {
    component.new_options = {auto_confirm: true, threshold_days: 30};
    postsService.updateTaskOptions.and.returnValue(throwError(() => new Error('synthetic failure')));

    component.saveSettings();

    expect(postsService.getTask).not.toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not save task settings. Try again.',
      'Dismiss'
    );
    expect(component.optionsChanged()).toBeTrue();
    expect(component.saving).toBeFalse();
  });

  it('does not start a duplicate settings save', () => {
    const response = new Subject<any>();
    component.new_options = {auto_confirm: true, threshold_days: 30};
    postsService.updateTaskOptions.and.returnValue(response);

    component.saveSettings();
    component.saveSettings();

    expect(postsService.updateTaskOptions).toHaveBeenCalledTimes(1);
    expect(component.saving).toBeTrue();
  });

  it('ignores a pending save result after destruction', () => {
    const response = new Subject<any>();
    component.new_options = {auto_confirm: true, threshold_days: 30};
    postsService.updateTaskOptions.and.returnValue(response);

    component.saveSettings();
    component.ngOnDestroy();
    response.next({success: true});

    expect(postsService.openSnackBar).not.toHaveBeenCalled();
    expect(component.saving).toBeFalse();
  });
});
