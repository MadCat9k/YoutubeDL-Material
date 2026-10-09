import { Clipboard } from '@angular/cdk/clipboard';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { PostsService } from 'app/posts.services';
import { DownloadsComponent } from './downloads.component';

describe('DownloadsComponent', () => {
  let component: DownloadsComponent;
  let postsService: jasmine.SpyObj<PostsService>;

  beforeEach(() => {
    postsService = jasmine.createSpyObj<PostsService>('PostsService', ['getCurrentDownloads']);
    component = new DownloadsComponent(
      postsService,
      {} as Router,
      {} as MatDialog,
      {} as Clipboard
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('labels downloads waiting for a worker as queued', () => {
    expect(component.STEP_INDEX_TO_LABEL[0]).toBe('Queued');
  });

  it('preserves valid falsy download values while merging updates', () => {
    const existing = [{
      uid: 'synthetic-download',
      title: 'Previous title',
      step_index: 1,
      percent_complete: 12,
      paused: true,
      obsolete: 'remove me'
    }];
    const update = [{
      uid: 'synthetic-download',
      title: '',
      step_index: 0,
      percent_complete: 0,
      paused: false
    }];

    const result = component.combineDownloads(existing as any, update as any);

    expect(result as any).toEqual([{
      uid: 'synthetic-download',
      title: '',
      step_index: 0,
      percent_complete: 0,
      paused: false
    }]);
  });

  it('uses compact columns and the action menu below the mobile breakpoint', () => {
    component.innerWidth = 455;

    component.recalculateColumns();

    expect(component.displayedColumns).toEqual(['title', 'percent_complete', 'actions']);
    expect(component.actionsFlex).toBe(1);
    expect(component.minimizeButtons).toBe(true);
  });

  it('does not start another downloads request while one is in flight', () => {
    const response = new Subject<any>();
    postsService.getCurrentDownloads.and.returnValue(response.asObservable());

    component.getCurrentDownloads();
    component.getCurrentDownloads();

    expect(postsService.getCurrentDownloads).toHaveBeenCalledTimes(1);

    response.next({downloads: []});
    response.complete();
    component.getCurrentDownloads();

    expect(postsService.getCurrentDownloads).toHaveBeenCalledTimes(2);
  });

  it('marks refresh failures and clears the warning after recovery', () => {
    postsService.getCurrentDownloads.and.returnValue(throwError(() => new Error('synthetic failure')));

    component.getCurrentDownloads();

    expect(component.downloads_connection_error).toBe(true);
    expect(component.consecutive_poll_failures).toBe(1);
    expect(component.getNextPollDelay()).toBe(2000);

    postsService.getCurrentDownloads.and.returnValue(of({downloads: []}));
    component.getCurrentDownloads();

    expect(component.downloads_connection_error).toBe(false);
    expect(component.consecutive_poll_failures).toBe(0);
    expect(component.getNextPollDelay()).toBe(1000);
  });

  it('cancels an in-flight downloads request when destroyed', () => {
    const response = new Subject<any>();
    postsService.getCurrentDownloads.and.returnValue(response.asObservable());
    component.getCurrentDownloads();

    component.ngOnDestroy();

    expect(response.observers.length).toBe(0);
    expect(component.downloads_request_in_flight).toBe(false);
  });
});
