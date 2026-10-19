import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PostsService } from 'app/posts.services';

import { ModifyUsersComponent } from './modify-users.component';

describe('ModifyUsersComponent', () => {
  let component: ModifyUsersComponent;

  beforeEach(() => {
    component = new ModifyUsersComponent(
      {} as PostsService,
      {} as MatSnackBar,
      {} as MatDialog,
      {} as MatDialogRef<ModifyUsersComponent>
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('provides localized names for icon-only user actions', () => {
    expect(component.userActionLabels).toEqual({
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit user',
      manage: 'Manage user',
      delete: 'Delete user'
    });
  });
});
