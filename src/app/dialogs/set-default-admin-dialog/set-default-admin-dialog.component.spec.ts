import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { PostsService } from 'app/posts.services';

import { SetDefaultAdminDialogComponent } from './set-default-admin-dialog.component';

describe('SetDefaultAdminDialogComponent', () => {
  let component: SetDefaultAdminDialogComponent;
  let fixture: ComponentFixture<SetDefaultAdminDialogComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ SetDefaultAdminDialogComponent ],
      providers: [
        {provide: PostsService, useValue: {}},
        {provide: MatDialogRef, useValue: {}}
      ]
    })
    .overrideComponent(SetDefaultAdminDialogComponent, {set: {template: ''}})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SetDefaultAdminDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
