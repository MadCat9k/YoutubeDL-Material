import { MatDialog } from '@angular/material/dialog';
import { PostsService } from 'app/posts.services';
import { of, Subject, throwError } from 'rxjs';
import { EditSubscriptionDialogComponent } from './edit-subscription-dialog.component';

describe('EditSubscriptionDialogComponent', () => {
  let component: EditSubscriptionDialogComponent;
  let postsService: jasmine.SpyObj<any>;

  beforeEach(() => {
    postsService = jasmine.createSpyObj('PostsService', [
      'updateSubscription',
      'reloadSubscriptions',
      'openSnackBar',
      'getSubscription'
    ]);
    component = new EditSubscriptionDialogComponent({
      sub: {
        id: 'synthetic-subscription',
        name: 'Synthetic subscription',
        type: 'video',
        timerange: null
      }
    }, {} as MatDialog, postsService as PostsService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('provides a localized name for the custom arguments action', () => {
    expect(component.subscriptionActionLabels.customArgs).toBe('Custom arguments');
  });

  it('announces a successful subscription update', () => {
    component.new_sub.paused = true;
    postsService.updateSubscription.and.returnValue(of({success: true}));

    component.saveSubscription();

    expect(postsService.updateSubscription).toHaveBeenCalledWith(component.new_sub);
    expect(component.sub.paused).toBeTrue();
    expect(postsService.reloadSubscriptions).toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Subscription updated.');
    expect(component.updating).toBeFalse();
  });

  it('preserves edits and reports a rejected subscription update', () => {
    component.new_sub.paused = true;
    postsService.updateSubscription.and.returnValue(of({success: false}));

    component.saveSubscription();

    expect(component.sub.paused).toBeUndefined();
    expect(component.new_sub.paused).toBeTrue();
    expect(postsService.reloadSubscriptions).not.toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Failed to update subscription. Try again.',
      'Dismiss'
    );
    expect(component.updating).toBeFalse();
  });

  it('preserves edits and reports a subscription request failure', () => {
    component.new_sub.paused = true;
    postsService.updateSubscription.and.returnValue(throwError(() => new Error('synthetic failure')));

    component.saveSubscription();

    expect(component.sub.paused).toBeUndefined();
    expect(component.new_sub.paused).toBeTrue();
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Failed to update subscription. Try again.',
      'Dismiss'
    );
    expect(component.updating).toBeFalse();
  });

  it('submits once and records the submitted snapshot', () => {
    const response = new Subject<any>();
    component.new_sub.paused = true;
    postsService.updateSubscription.and.returnValue(response);

    component.saveSubscription();
    component.saveSubscription();
    component.new_sub.paused = false;
    response.next({success: true});
    response.complete();

    expect(postsService.updateSubscription).toHaveBeenCalledTimes(1);
    expect(component.sub.paused).toBeTrue();
    expect(component.new_sub.paused).toBeFalse();
    expect(component.subChanged()).toBeTrue();
    expect(component.updating).toBeFalse();
  });

  it('ignores a pending update after destruction', () => {
    const response = new Subject<any>();
    component.new_sub.paused = true;
    postsService.updateSubscription.and.returnValue(response);

    component.saveSubscription();
    component.ngOnDestroy();
    response.next({success: true});

    expect(component.sub.paused).toBeUndefined();
    expect(postsService.reloadSubscriptions).not.toHaveBeenCalled();
  });
});
