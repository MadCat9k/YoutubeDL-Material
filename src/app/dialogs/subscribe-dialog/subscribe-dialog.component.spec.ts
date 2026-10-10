import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';

import { PostsService } from 'app/posts.services';
import { SubscribeDialogComponent } from './subscribe-dialog.component';

describe('SubscribeDialogComponent', () => {
  let component: SubscribeDialogComponent;
  let postsService: jasmine.SpyObj<PostsService>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<SubscribeDialogComponent>>;
  let response: Subject<any>;

  beforeEach(() => {
    postsService = jasmine.createSpyObj<PostsService>('PostsService', ['createSubscription', 'openSnackBar']);
    dialogRef = jasmine.createSpyObj<MatDialogRef<SubscribeDialogComponent>>('MatDialogRef', ['close']);
    response = new Subject<any>();
    postsService.createSubscription.and.returnValue(response.asObservable());
    component = new SubscribeDialogComponent(postsService, {} as MatDialog, dialogRef);
    component.url = ' https://example.invalid/channel/synthetic ';
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('prevents duplicate submissions while creation is active', () => {
    component.subscribeClicked();
    component.subscribeClicked();

    expect(postsService.createSubscription).toHaveBeenCalledTimes(1);
    expect(postsService.createSubscription.calls.mostRecent().args[0]).toBe('https://example.invalid/channel/synthetic');
    expect(component.subscribing).toBe(true);
    expect(component.subscriptionError).toBe('');
  });

  it('keeps the form open with an actionable backend error', () => {
    const error = 'A subscription with this URL already exists. Custom name is required.';
    component.name = 'Synthetic duplicate';
    component.subscribeClicked();

    response.next({new_sub: null, error});
    response.complete();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.url).toContain('synthetic');
    expect(component.name).toBe('Synthetic duplicate');
    expect(component.subscribing).toBe(false);
    expect(component.subscriptionError).toBe(error);
  });

  it('keeps the form open after a network failure without exposing unknown details', () => {
    component.subscribeClicked();

    response.error({error: {error: 'private upstream diagnostic'}});

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.subscribing).toBe(false);
    expect(component.subscriptionError).toContain('Could not create the subscription');
    expect(component.subscriptionError).not.toContain('private upstream diagnostic');
  });

  it('closes with the new subscription after successful creation', () => {
    const newSubscription = {id: 'synthetic-subscription-id'};
    component.subscribeClicked();

    response.next({new_sub: newSubscription});

    expect(dialogRef.close).toHaveBeenCalledOnceWith(newSubscription);
    expect(component.subscribing).toBe(false);
  });

  it('cancels active creation when the dialog is destroyed', () => {
    component.subscribeClicked();

    component.ngOnDestroy();

    expect(response.observers.length).toBe(0);
    expect(component.subscriptionRequest).toBeNull();
  });
});
