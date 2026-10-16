import { MatDialog } from '@angular/material/dialog';
import { PostsService } from 'app/posts.services';
import { EditSubscriptionDialogComponent } from './edit-subscription-dialog.component';

describe('EditSubscriptionDialogComponent', () => {
  let component: EditSubscriptionDialogComponent;

  beforeEach(() => {
    component = new EditSubscriptionDialogComponent({
      sub: {
        id: 'synthetic-subscription',
        name: 'Synthetic subscription',
        type: 'video',
        timerange: null
      }
    }, {} as MatDialog, {} as PostsService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('provides a localized name for the custom arguments action', () => {
    expect(component.subscriptionActionLabels.customArgs).toBe('Custom arguments');
  });
});
