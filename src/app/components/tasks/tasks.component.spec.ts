import { Clipboard } from '@angular/cdk/clipboard';
import { MatDialog } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';

import { PostsService } from 'app/posts.services';
import { TasksComponent } from './tasks.component';

describe('TasksComponent', () => {
  let component: TasksComponent;
  let postsService: jasmine.SpyObj<PostsService>;

  beforeEach(() => {
    postsService = jasmine.createSpyObj<PostsService>('PostsService', ['getTasks']);
    component = new TasksComponent(
      postsService,
      {} as MatDialog,
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
});
