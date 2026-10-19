import { MatDialog, MatDialogRef } from '@angular/material/dialog';

import { ArgModifierDialogComponent } from './arg-modifier-dialog.component';

describe('ArgModifierDialogComponent', () => {
  let component: ArgModifierDialogComponent;

  beforeEach(() => {
    component = new ArgModifierDialogComponent(
      null,
      {} as MatDialogRef<ArgModifierDialogComponent>,
      {} as MatDialog
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('provides a localized name for argument information actions', () => {
    expect(component.argumentInfoLabel).toBe('Info');
  });
});
