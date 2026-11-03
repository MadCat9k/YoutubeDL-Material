import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { PostsService } from 'app/posts.services';

import { UserProfileDialogComponent } from './user-profile-dialog.component';

describe('UserProfileDialogComponent', () => {
  let component: UserProfileDialogComponent;
  let fixture: ComponentFixture<UserProfileDialogComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ UserProfileDialogComponent ],
      providers: [
        {
          provide: PostsService,
          useValue: {sidepanel_mode: null, card_size: null, getSupportedLocales: () => of({supported_locales: []})}
        },
        {provide: Router, useValue: {}},
        {provide: MatDialogRef, useValue: {}}
      ]
    })
    .overrideComponent(UserProfileDialogComponent, {set: {template: ''}})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(UserProfileDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
