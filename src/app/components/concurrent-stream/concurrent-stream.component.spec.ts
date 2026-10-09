import { SimpleChange } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';

import { PostsService } from 'app/posts.services';
import { ConcurrentStreamComponent } from './concurrent-stream.component';

describe('ConcurrentStreamComponent', () => {
  let component: ConcurrentStreamComponent;
  let postsService: jasmine.SpyObj<PostsService>;

  beforeEach(() => {
    postsService = jasmine.createSpyObj<PostsService>('PostsService', [
      'checkConcurrentStream',
      'updateConcurrentStream'
    ]);
    component = new ConcurrentStreamComponent(postsService);
    component.uid = 'synthetic-file';
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not overlap stream checks', () => {
    const response = new Subject<any>();
    postsService.checkConcurrentStream.and.returnValue(response.asObservable());
    component.check_polling_stopped = false;

    component.checkStream();
    component.checkStream();

    expect(postsService.checkConcurrentStream).toHaveBeenCalledTimes(1);

    response.next({stream: null});
    response.complete();
    component.checkStream();

    expect(postsService.checkConcurrentStream).toHaveBeenCalledTimes(2);
  });

  it('does not overlap host updates', () => {
    const response = new Subject<any>();
    postsService.updateConcurrentStream.and.returnValue(response.asObservable());
    component.update_polling_stopped = false;

    component.updateStream();
    component.updateStream();

    expect(postsService.updateConcurrentStream).toHaveBeenCalledTimes(1);

    response.next({stream: {}});
    response.complete();
    component.updateStream();

    expect(postsService.updateConcurrentStream).toHaveBeenCalledTimes(2);
  });

  it('backs off after a stream refresh failure and recovers after success', () => {
    component.check_polling_stopped = false;
    postsService.checkConcurrentStream.and.returnValue(throwError(() => new Error('synthetic failure')));

    component.checkStream();

    expect(component.stream_connection_error).toBe(true);
    expect(component.getNextPollDelay()).toBe(2000);

    postsService.checkConcurrentStream.and.returnValue(of({stream: null}));
    component.checkStream();

    expect(component.stream_connection_error).toBe(false);
    expect(component.getNextPollDelay()).toBe(1000);
  });

  it('switches from discovery checks to serialized host updates', () => {
    const checkResponse = new Subject<any>();
    const updateResponse = new Subject<any>();
    postsService.checkConcurrentStream.and.returnValue(checkResponse.asObservable());
    postsService.updateConcurrentStream.and.returnValue(updateResponse.asObservable());

    component.startWatching();
    component.startServer();

    expect(checkResponse.observers.length).toBe(0);
    expect(component.check_polling_stopped).toBe(true);
    expect(postsService.updateConcurrentStream).toHaveBeenCalledTimes(1);
  });

  it('cancels old-file work and resets state when the uid changes', () => {
    const response = new Subject<any>();
    postsService.checkConcurrentStream.and.returnValue(response.asObservable());
    component.startWatching();
    component.started = true;

    component.uid = 'replacement-file';
    component.ngOnChanges({uid: new SimpleChange('synthetic-file', 'replacement-file', false)});

    expect(response.observers.length).toBe(0);
    expect(component.watch_together_clicked).toBe(false);
    expect(component.started).toBe(false);
    expect(component.server_already_exists).toBeNull();
  });

  it('cancels an active host update when destroyed', () => {
    const response = new Subject<any>();
    postsService.updateConcurrentStream.and.returnValue(response.asObservable());
    component.startServer();

    component.ngOnDestroy();

    expect(response.observers.length).toBe(0);
    expect(component.update_request_in_flight).toBe(false);
  });

  it('restores the normal playback rate when stopped', () => {
    spyOn(component.setPlaybackRate, 'emit');
    component.playback_rate_modified = true;
    component.playback_rate_timeout = setTimeout(() => undefined, 10000);

    component.stop();

    expect(component.setPlaybackRate.emit).toHaveBeenCalledWith(1);
    expect(component.playback_rate_timeout).toBeNull();
  });
});
