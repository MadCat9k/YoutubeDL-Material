import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';

import { PostsService } from 'app/posts.services';
import { SubscriptionComponent } from './subscription.component';

describe('SubscriptionComponent', () => {
  let component: SubscriptionComponent;
  let fixture: ComponentFixture<SubscriptionComponent>;
  let routeParams: Subject<any>;
  let subscriptionResponses: {[subId: string]: Subject<any>};
  let checkResponse: Subject<any>;
  let cancelCheckResponse: Subject<any>;
  let postsService: jasmine.SpyObj<PostsService> & {
    service_initialized: BehaviorSubject<boolean>;
    files_changed: BehaviorSubject<boolean>;
    config: any;
  };

  beforeEach(async () => {
    routeParams = new Subject();
    subscriptionResponses = {
      subscriptionA: new Subject(),
      subscriptionB: new Subject()
    };
    checkResponse = new Subject();
    cancelCheckResponse = new Subject();
    postsService = Object.assign(
      jasmine.createSpyObj<PostsService>('PostsService', [
        'getSubscription',
        'checkSubscription',
        'cancelCheckSubscription',
        'downloadSubFromServer',
        'openSnackBar'
      ]),
      {
        service_initialized: new BehaviorSubject(true),
        files_changed: new BehaviorSubject(false),
        config: {Downloader: {use_youtubedl_archive: false}}
      }
    );
    postsService.getSubscription.and.callFake(subId => subscriptionResponses[subId]);
    postsService.checkSubscription.and.returnValue(checkResponse);
    postsService.cancelCheckSubscription.and.returnValue(cancelCheckResponse);

    await TestBed.configureTestingModule({
      declarations: [SubscriptionComponent],
      providers: [
        {provide: PostsService, useValue: postsService},
        {provide: ActivatedRoute, useValue: {params: routeParams}},
        {provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigate'])},
        {provide: MatDialog, useValue: jasmine.createSpyObj<MatDialog>('MatDialog', ['open'])}
      ]
    })
      .overrideComponent(SubscriptionComponent, {set: {template: ''}})
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SubscriptionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('keeps one request and polling interval when the route changes from A to B', fakeAsync(() => {
    routeParams.next({id: 'subscriptionA'});
    expect(postsService.getSubscription.calls.mostRecent().args[0]).toBe('subscriptionA');
    expect(subscriptionResponses.subscriptionA.observers.length).toBe(1);

    routeParams.next({id: 'subscriptionB'});
    expect(postsService.getSubscription.calls.mostRecent().args[0]).toBe('subscriptionB');
    expect(subscriptionResponses.subscriptionA.observers.length).toBe(0);
    expect(subscriptionResponses.subscriptionB.observers.length).toBe(1);

    tick(1000);
    expect(postsService.getSubscription).toHaveBeenCalledTimes(2);

    subscriptionResponses.subscriptionB.next({
      subscription: {id: 'subscriptionB', videos: [], downloading: false}
    });
    subscriptionResponses.subscriptionB.complete();
    tick(1000);

    expect(postsService.getSubscription).toHaveBeenCalledTimes(3);
    expect(postsService.getSubscription.calls.mostRecent().args[0]).toBe('subscriptionB');
    expect(component.subscription.id).toBe('subscriptionB');

    fixture.destroy();
    expect(routeParams.observers.length).toBe(0);
    expect(subscriptionResponses.subscriptionB.observers.length).toBe(0);
    tick(2000);
    expect(postsService.getSubscription).toHaveBeenCalledTimes(3);
  }));

  it('backs off after a refresh failure and recovers after success', fakeAsync(() => {
    const failedRequest = new Subject<any>();
    const recoveredRequest = new Subject<any>();
    postsService.getSubscription.and.returnValues(failedRequest, recoveredRequest);

    routeParams.next({id: 'subscriptionA'});
    failedRequest.error(new Error('synthetic failure'));

    expect(component.subscriptionConnectionError).toBe(true);
    expect(component.getNextPollDelay()).toBe(2000);

    tick(1999);
    expect(postsService.getSubscription).toHaveBeenCalledTimes(1);
    tick(1);
    expect(postsService.getSubscription).toHaveBeenCalledTimes(2);

    recoveredRequest.next({
      subscription: {id: 'subscriptionA', videos: [], downloading: false}
    });
    recoveredRequest.complete();

    expect(component.subscriptionConnectionError).toBe(false);
    expect(component.getNextPollDelay()).toBe(1000);

    fixture.destroy();
  }));

  it('reports a manual check from start through completion', () => {
    routeParams.next({id: 'subscriptionA'});
    subscriptionResponses.subscriptionA.next({
      subscription: {id: 'subscriptionA', videos: [], downloading: false}
    });

    component.checkSubscription();
    component.checkSubscription();

    expect(postsService.checkSubscription).toHaveBeenCalledOnceWith('subscriptionA');
    expect(component.checkStatus).toBe('starting');

    checkResponse.next({success: true});
    checkResponse.complete();
    expect(component.checkStatus).toBe('scanning');

    subscriptionResponses.subscriptionA.next({
      subscription: {id: 'subscriptionA', videos: [], downloading: true}
    });
    subscriptionResponses.subscriptionA.next({
      subscription: {id: 'subscriptionA', videos: [{uid: 'synthetic-file'}], downloading: false}
    });

    expect(component.checkStatus).toBe('completed');
    expect(component.checkAddedCount).toBe(1);
    expect(component.checkCompletedAt).not.toBeNull();
    fixture.destroy();
  });

  it('completes a fast manual check even when polling misses the active state', () => {
    routeParams.next({id: 'subscriptionA'});
    subscriptionResponses.subscriptionA.next({
      subscription: {id: 'subscriptionA', videos: [], downloading: false}
    });
    component.checkSubscription();
    checkResponse.next({success: true});
    checkResponse.complete();

    subscriptionResponses.subscriptionA.next({
      subscription: {id: 'subscriptionA', videos: [], downloading: false}
    });
    expect(component.checkStatus).toBe('scanning');
    subscriptionResponses.subscriptionA.next({
      subscription: {id: 'subscriptionA', videos: [], downloading: false}
    });

    expect(component.checkStatus).toBe('completed');
    expect(component.checkAddedCount).toBe(0);
    fixture.destroy();
  });

  it('shows failure feedback without logging a raw request error', () => {
    routeParams.next({id: 'subscriptionA'});
    subscriptionResponses.subscriptionA.next({
      subscription: {id: 'subscriptionA', videos: [], downloading: false}
    });
    component.checkSubscription();

    checkResponse.error(new Error('synthetic private diagnostic'));

    expect(component.checkStatus).toBe('failed');
    expect(component.check_clicked).toBe(false);
    fixture.destroy();
  });

  it('cancels action requests and resets feedback when the route changes', () => {
    routeParams.next({id: 'subscriptionA'});
    subscriptionResponses.subscriptionA.next({
      subscription: {id: 'subscriptionA', videos: [], downloading: false}
    });
    component.checkSubscription();

    routeParams.next({id: 'subscriptionB'});

    expect(checkResponse.observers.length).toBe(0);
    expect(component.checkStatus).toBe('idle');
    expect(component.check_clicked).toBe(false);
    fixture.destroy();
  });

  it('reports cancellation and prevents duplicate cancel requests', () => {
    routeParams.next({id: 'subscriptionA'});
    subscriptionResponses.subscriptionA.next({
      subscription: {id: 'subscriptionA', videos: [], downloading: true}
    });

    component.cancelCheckSubscription();
    component.cancelCheckSubscription();

    expect(postsService.cancelCheckSubscription).toHaveBeenCalledOnceWith('subscriptionA');
    expect(component.checkStatus).toBe('cancelling');
    cancelCheckResponse.next({success: true});
    cancelCheckResponse.complete();
    expect(component.checkStatus).toBe('cancelled');
    expect(component.cancel_clicked).toBe(false);
    fixture.destroy();
  });

  it('ignores check actions before subscription data is available', () => {
    component.checkSubscription();
    component.cancelCheckSubscription();

    expect(postsService.checkSubscription).not.toHaveBeenCalled();
    expect(postsService.cancelCheckSubscription).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('downloads subscription media and announces the result', () => {
    const archiveBlob = new Blob(['synthetic archive']);
    component.id = 'subscriptionA';
    component.subscription = {id: 'subscriptionA', name: 'Synthetic subscription'} as any;
    postsService.downloadSubFromServer.and.returnValue(of(archiveBlob));
    spyOn(component, 'saveSubscriptionArchive');

    component.downloadContent();

    expect(postsService.downloadSubFromServer).toHaveBeenCalledOnceWith('subscriptionA');
    expect(component.saveSubscriptionArchive).toHaveBeenCalledOnceWith(archiveBlob, 'Synthetic subscription');
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Subscription download started.');
    expect(component.downloading).toBeFalse();
    fixture.destroy();
  });

  it('reports a failed subscription media request and restores the action', () => {
    component.id = 'subscriptionA';
    component.subscription = {id: 'subscriptionA', name: 'Synthetic subscription'} as any;
    postsService.downloadSubFromServer.and.returnValue(throwError(() => new Error('synthetic failure')));
    spyOn(component, 'saveSubscriptionArchive');

    component.downloadContent();

    expect(component.saveSubscriptionArchive).not.toHaveBeenCalled();
    expect(component.downloading).toBeFalse();
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not download subscription. Try again.',
      'Dismiss'
    );
    fixture.destroy();
  });

  it('reports a local subscription media save failure', () => {
    component.id = 'subscriptionA';
    component.subscription = {id: 'subscriptionA', name: 'Synthetic subscription'} as any;
    postsService.downloadSubFromServer.and.returnValue(of(new Blob(['synthetic archive'])));
    spyOn(component, 'saveSubscriptionArchive').and.throwError('synthetic save failure');

    component.downloadContent();

    expect(component.downloading).toBeFalse();
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not download subscription. Try again.',
      'Dismiss'
    );
    fixture.destroy();
  });

  it('starts only one subscription media request while pending', () => {
    const response = new Subject<Blob>();
    component.id = 'subscriptionA';
    component.subscription = {id: 'subscriptionA', name: 'Synthetic subscription'} as any;
    postsService.downloadSubFromServer.and.returnValue(response);

    component.downloadContent();
    component.downloadContent();

    expect(postsService.downloadSubFromServer).toHaveBeenCalledTimes(1);
    expect(component.downloading).toBeTrue();
    fixture.destroy();
  });

  it('cancels a pending subscription media request when the route changes', () => {
    const response = new Subject<Blob>();
    routeParams.next({id: 'subscriptionA'});
    subscriptionResponses.subscriptionA.next({
      subscription: {id: 'subscriptionA', name: 'Synthetic subscription', videos: [], downloading: false}
    });
    postsService.downloadSubFromServer.and.returnValue(response);
    spyOn(component, 'saveSubscriptionArchive');
    component.downloadContent();

    routeParams.next({id: 'subscriptionB'});
    response.next(new Blob(['synthetic archive']));

    expect(response.observers.length).toBe(0);
    expect(component.saveSubscriptionArchive).not.toHaveBeenCalled();
    expect(postsService.openSnackBar).not.toHaveBeenCalled();
    expect(component.downloading).toBeFalse();
    fixture.destroy();
  });
});
