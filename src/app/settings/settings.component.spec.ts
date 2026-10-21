import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { TestBed, waitForAsync } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

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
      killAllDownloads: jasmine.createSpy('killAllDownloads'),
      restartServer: jasmine.createSpy('restartServer').and.returnValue(of({success: true})),
      setConfig: jasmine.createSpy('setConfig'),
      checkAdminCreationStatus: jasmine.createSpy('checkAdminCreationStatus'),
      reload_config: {next: jasmine.createSpy('reloadConfig')},
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

  it('provides descriptive groups for the Main settings section', () => {
    expect(component.mainSectionLabels).toEqual({
      server: 'Server connection',
      userAccess: 'User access',
      subscriptions: 'Subscriptions',
      appearance: 'Appearance'
    });
  });

  it('provides descriptive groups for the Downloader settings section', () => {
    expect(component.downloaderSectionLabels).toEqual({
      paths: 'Paths and naming',
      categories: 'Categories',
      files: 'Archive and sidecar files',
      limits: 'Limits'
    });
  });

  it('provides descriptive groups for the Extra settings section', () => {
    expect(component.extraSectionLabels).toEqual({
      interface: 'Interface and playback',
      publicApi: 'Public API',
      integrations: 'Media integrations',
      rss: 'RSS feed',
      browserTools: 'Browser tools'
    });
  });

  it('provides descriptive groups for the Database settings section', () => {
    expect(component.databaseSectionLabels).toEqual({
      status: 'Status and records',
      connection: 'MongoDB connection',
      transfer: 'Data transfer'
    });
  });

  it('provides descriptive groups for the Notifications settings section', () => {
    expect(component.notificationSectionLabels).toEqual({
      scope: 'Notification scope',
      webhooks: 'Webhooks',
      pushServices: 'Push services'
    });
  });

  it('provides descriptive groups for the Advanced settings section', () => {
    expect(component.advancedSectionLabels).toEqual({
      downloader: 'Download engine',
      runtime: 'Runtime and sessions',
      authentication: 'Download authentication',
      updates: 'Application updates'
    });
  });

  it('provides descriptive groups for the Users settings section', () => {
    expect(component.userSectionLabels).toEqual({
      registration: 'Registration',
      authentication: 'Authentication',
      ldap: 'LDAP directory',
      management: 'User management'
    });
  });

  it('provides accessible names for icon-only Settings actions', () => {
    expect(component.settingsActionLabels).toEqual({
      customArgs: 'Custom args',
      editCategory: 'Edit category',
      deleteCategory: 'Delete category',
      addCategory: 'Add category'
    });
  });

  it('finds settings sections by labels and help concepts', () => {
    component.settingsSearchQuery = 'DOWNLOAD RATE';
    expect(component.filteredSettingsSections.map(section => section.key)).toEqual(['downloader']);

    component.settingsSearchQuery = 'webhook';
    expect(component.filteredSettingsSections.map(section => section.key)).toEqual(['notifications']);

    component.settingsSearchQuery = '   ';
    expect(component.filteredSettingsSections).toEqual([]);
  });

  it('navigates to an enabled search result and clears the query', () => {
    component.settingsSearchQuery = 'database';

    component.selectSettingsSearchSection(component.filteredSettingsSections[0]);

    expect(component.tabIndex).toBe(3);
    expect(component.settingsSearchQuery).toBe('');
    expect(router.navigate).toHaveBeenCalledWith(['/settings', {tab: 'database'}]);
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

  it('accepts only valid TCP ports', () => {
    component.new_config = {Host: {port: '17442'}};
    expect(component.settingsValid()).toBe(true);

    component.new_config.Host.port = '0';
    expect(component.settingsValid()).toBe(false);

    component.new_config.Host.port = '65536';
    expect(component.settingsValid()).toBe(false);

    component.new_config.Host.port = '12.5';
    expect(component.settingsValid()).toBe(false);

    component.new_config.Host.port = '';
    expect(component.settingsValid()).toBe(false);
  });

  it('announces a successful settings save', () => {
    component.initial_config = {Host: {port: '17442'}, Advanced: {multi_user_mode: false}, label: 'old'};
    component.new_config = {Host: {port: '17442'}, Advanced: {multi_user_mode: false}, label: 'new'};
    postsService.setConfig.and.returnValue(of({success: true}));

    component.saveSettings();

    expect(postsService.setConfig).toHaveBeenCalledWith({YoutubeDLMaterial: component.new_config});
    expect(component.initial_config.label).toBe('new');
    expect(postsService.reload_config.next).toHaveBeenCalledWith(true);
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Settings saved.');
    expect(component.savingSettings).toBeFalse();
  });

  it('preserves edits and reports a rejected settings save', () => {
    component.initial_config = {Host: {port: '17442'}, Advanced: {multi_user_mode: false}, label: 'old'};
    component.new_config = {Host: {port: '17442'}, Advanced: {multi_user_mode: false}, label: 'new'};
    postsService.setConfig.and.returnValue(of({success: false}));

    component.saveSettings();

    expect(component.initial_config.label).toBe('old');
    expect(component.new_config.label).toBe('new');
    expect(postsService.reload_config.next).not.toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Failed to save settings. Try again.', 'Dismiss');
    expect(component.savingSettings).toBeFalse();
  });

  it('preserves edits and reports a settings request failure', () => {
    component.initial_config = {Host: {port: '17442'}, Advanced: {multi_user_mode: false}, label: 'old'};
    component.new_config = {Host: {port: '17442'}, Advanced: {multi_user_mode: false}, label: 'new'};
    postsService.setConfig.and.returnValue(throwError(() => new Error('synthetic failure')));

    component.saveSettings();

    expect(component.initial_config.label).toBe('old');
    expect(component.new_config.label).toBe('new');
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Failed to save settings. Try again.', 'Dismiss');
    expect(component.savingSettings).toBeFalse();
  });

  it('submits once and records the submitted snapshot', () => {
    const response = new Subject<any>();
    component.initial_config = {Host: {port: '17442'}, Advanced: {multi_user_mode: false}, label: 'old'};
    component.new_config = {Host: {port: '17442'}, Advanced: {multi_user_mode: false}, label: 'submitted'};
    postsService.setConfig.and.returnValue(response);

    component.saveSettings();
    component.saveSettings();
    component.new_config.label = 'edited while saving';
    response.next({success: true});
    response.complete();

    expect(postsService.setConfig).toHaveBeenCalledTimes(1);
    expect(component.initial_config.label).toBe('submitted');
    expect(component.new_config.label).toBe('edited while saving');
    expect(component.settingsSame()).toBeFalse();
    expect(component.savingSettings).toBeFalse();
  });

  it('ignores a pending settings result after destruction', () => {
    const response = new Subject<any>();
    component.initial_config = {Host: {port: '17442'}, Advanced: {multi_user_mode: false}, label: 'old'};
    component.new_config = {Host: {port: '17442'}, Advanced: {multi_user_mode: false}, label: 'new'};
    postsService.setConfig.and.returnValue(response);

    component.saveSettings();
    component.ngOnDestroy();
    response.next({success: true});

    expect(component.initial_config.label).toBe('old');
    expect(postsService.reload_config.next).not.toHaveBeenCalled();
  });

  it('does not kill downloads when confirmation is cancelled', () => {
    dialog.open.and.returnValue({afterClosed: () => of(false)});

    component.killAllDownloads();

    expect(postsService.killAllDownloads).not.toHaveBeenCalled();
  });

  it('announces when all downloads are stopped', () => {
    dialog.open.and.returnValue({afterClosed: () => of(true)});
    postsService.killAllDownloads.and.returnValue(of({success: true}));

    component.killAllDownloads();

    expect(postsService.openSnackBar).toHaveBeenCalledWith('Successfully killed all downloads!');
    expect(component.killingAllDownloads).toBeFalse();
  });

  it('allows retry after a rejected kill-all request', () => {
    dialog.open.and.returnValue({afterClosed: () => of(true)});
    postsService.killAllDownloads.and.returnValue(of({success: false}));

    component.killAllDownloads();

    expect(postsService.openSnackBar).toHaveBeenCalledWith('Failed to stop all downloads. Try again.', 'Dismiss');
    expect(component.killingAllDownloads).toBeFalse();
  });

  it('allows retry after a failed kill-all request', () => {
    dialog.open.and.returnValue({afterClosed: () => of(true)});
    postsService.killAllDownloads.and.returnValue(throwError(() => new Error('synthetic failure')));

    component.killAllDownloads();

    expect(postsService.openSnackBar).toHaveBeenCalledWith('Failed to stop all downloads. Try again.', 'Dismiss');
    expect(component.killingAllDownloads).toBeFalse();
  });

  it('does not start a second kill-all request while one is pending', () => {
    const response = new Subject<any>();
    dialog.open.and.returnValue({afterClosed: () => of(true)});
    postsService.killAllDownloads.and.returnValue(response);

    component.killAllDownloads();
    component.killAllDownloads();

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(postsService.killAllDownloads).toHaveBeenCalledTimes(1);
    expect(component.killingAllDownloads).toBeTrue();
  });

  it('ignores a pending kill-all result after destruction', () => {
    const response = new Subject<any>();
    dialog.open.and.returnValue({afterClosed: () => of(true)});
    postsService.killAllDownloads.and.returnValue(response);

    component.killAllDownloads();
    component.ngOnDestroy();
    response.next({success: true});

    expect(postsService.openSnackBar).not.toHaveBeenCalled();
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
