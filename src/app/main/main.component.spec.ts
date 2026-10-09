import { Platform } from '@angular/cdk/platform';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { PostsService } from 'app/posts.services';
import { YoutubeSearchService } from 'app/youtube-search.service';
import { MainComponent } from './main.component';

describe('MainComponent', () => {
  let component: MainComponent;
  let postsService: jasmine.SpyObj<PostsService>;

  beforeEach(() => {
    postsService = jasmine.createSpyObj<PostsService>('PostsService', ['getCurrentDownload', 'openSnackBar']);
    component = new MainComponent(
      postsService,
      {} as YoutubeSearchService,
      {} as MatSnackBar,
      {} as Router,
      {} as MatDialog,
      {} as Platform,
      {} as ActivatedRoute
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not overlap active download progress requests', () => {
    const response = new Subject<any>();
    postsService.getCurrentDownload.and.returnValue(response.asObservable());
    component.current_download = {uid: 'synthetic-download'} as any;

    component.getCurrentDownload();
    component.getCurrentDownload();

    expect(postsService.getCurrentDownload).toHaveBeenCalledTimes(1);

    response.next({download: {uid: 'synthetic-download', finished: false, percent_complete: 10}});
    response.complete();
    component.getCurrentDownload();

    expect(postsService.getCurrentDownload).toHaveBeenCalledTimes(2);
  });

  it('ignores progress returned for a replaced download', () => {
    const response = new Subject<any>();
    postsService.getCurrentDownload.and.returnValue(response.asObservable());
    component.current_download = {uid: 'first-synthetic-download'} as any;

    component.getCurrentDownload();
    component.current_download = {uid: 'second-synthetic-download'} as any;
    response.next({download: {uid: 'first-synthetic-download', percent_complete: 80}});
    response.complete();

    expect(component.current_download.uid).toBe('second-synthetic-download');
  });

  it('backs off after a progress failure and recovers after success', () => {
    component.current_download = {uid: 'synthetic-download'} as any;
    postsService.getCurrentDownload.and.returnValue(throwError(() => new Error('synthetic failure')));

    component.getCurrentDownload();

    expect(component.currentDownloadConnectionError).toBe(true);
    expect(component.getNextPollDelay()).toBe(2000);

    postsService.getCurrentDownload.and.returnValue(of({
      download: {uid: 'synthetic-download', finished: false, percent_complete: 20}
    } as any));
    component.getCurrentDownload();

    expect(component.currentDownloadConnectionError).toBe(false);
    expect(component.getNextPollDelay()).toBe(1000);
  });

  it('cancels an active progress request when destroyed', () => {
    const response = new Subject<any>();
    postsService.getCurrentDownload.and.returnValue(response.asObservable());
    component.current_download = {uid: 'synthetic-download'} as any;
    component.getCurrentDownload();

    component.ngOnDestroy();

    expect(response.observers.length).toBe(0);
    expect(component.current_download_request_in_flight).toBe(false);
  });
});
