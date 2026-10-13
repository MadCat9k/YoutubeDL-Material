import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { TestBed, waitForAsync } from '@angular/core/testing';
import { of, Subject } from 'rxjs';

import { PostsService } from 'app/posts.services';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let postsService: any;
  let router: jasmine.SpyObj<any>;
  let dialog: jasmine.SpyObj<any>;

  beforeEach(() => {
    postsService = {
      config: {Advanced: {multi_user_mode: false}},
      initialized: false,
      service_initialized: new Subject<boolean>(),
      getLatestGithubRelease: () => of(null),
      restartServer: jasmine.createSpy('restartServer').and.returnValue(of({success: true})),
      openSnackBar: jasmine.createSpy('openSnackBar')
    };
    router = jasmine.createSpyObj('Router', ['navigate']);
    dialog = jasmine.createSpyObj('MatDialog', ['open']);
    component = new SettingsComponent(
      postsService,
      {} as any,
      {bypassSecurityTrustUrl: value => value} as any,
      dialog,
      router,
      {snapshot: {paramMap: {get: () => null}}} as any
    );
  });

  it('uses compact settings navigation below the mobile breakpoint', () => {
    component.updateNavigationMode(320);
    expect(component.compactNavigation).toBe(true);

    component.updateNavigationMode(649);
    expect(component.compactNavigation).toBe(true);

    component.updateNavigationMode(650);
    expect(component.compactNavigation).toBe(false);
  });

  it('updates the route when a settings section is selected', () => {
    component.selectSettingsSection(3);

    expect(component.tabIndex).toBe(3);
    expect(router.navigate).toHaveBeenCalledWith(['/settings', {tab: 'database'}]);
  });

  it('does not select the Users section while multi-user mode is disabled', () => {
    component.selectSettingsSection(6);

    expect(component.tabIndex).toBe(0);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not restart the server when confirmation is cancelled', () => {
    dialog.open.and.returnValue({afterClosed: () => of(false)});

    component.restartServer();

    expect(postsService.restartServer).not.toHaveBeenCalled();
  });

  it('restarts the server after confirmation', () => {
    dialog.open.and.returnValue({afterClosed: () => of(true)});

    component.restartServer();

    expect(postsService.restartServer).toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Restarting!');
  });
});

describe('SettingsComponent layout', () => {
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [SettingsComponent],
      imports: [CommonModule, FormsModule],
      providers: [
        {
          provide: PostsService,
          useValue: {
            config: {Advanced: {multi_user_mode: false}},
            initialized: false,
            service_initialized: new Subject<boolean>(),
            getLatestGithubRelease: () => of(null),
            theme: null
          }
        },
        {provide: MatSnackBar, useValue: {}},
        {provide: DomSanitizer, useValue: {bypassSecurityTrustUrl: value => value}},
        {provide: MatDialog, useValue: {}},
        {provide: Router, useValue: {navigate: jasmine.createSpy('navigate')}},
        {provide: ActivatedRoute, useValue: {snapshot: {paramMap: {get: () => null}}}}
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();
  }));

  it('lets the application pane own vertical scrolling', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    const settingsTabs = fixture.nativeElement.querySelector('.settings-tabs');
    expect(settingsTabs.style.height).toBe('');
  });
});
