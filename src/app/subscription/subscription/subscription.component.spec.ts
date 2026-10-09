import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, Subject } from 'rxjs';

import { PostsService } from 'app/posts.services';
import { SubscriptionComponent } from './subscription.component';

describe('SubscriptionComponent', () => {
  let component: SubscriptionComponent;
  let fixture: ComponentFixture<SubscriptionComponent>;
  let routeParams: Subject<any>;
  let subscriptionResponses: {[subId: string]: Subject<any>};
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
    postsService = Object.assign(
      jasmine.createSpyObj<PostsService>('PostsService', ['getSubscription']),
      {
        service_initialized: new BehaviorSubject(true),
        files_changed: new BehaviorSubject(false),
        config: {Downloader: {use_youtubedl_archive: false}}
      }
    );
    postsService.getSubscription.and.callFake(subId => subscriptionResponses[subId]);

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
});
