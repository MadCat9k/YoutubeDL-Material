import { of, Subject } from 'rxjs';

import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let postsService: any;
  let router: jasmine.SpyObj<any>;

  beforeEach(() => {
    postsService = {
      config: {Advanced: {multi_user_mode: false}},
      initialized: false,
      service_initialized: new Subject<boolean>(),
      getLatestGithubRelease: () => of(null)
    };
    router = jasmine.createSpyObj('Router', ['navigate']);
    component = new SettingsComponent(
      postsService,
      {} as any,
      {bypassSecurityTrustUrl: value => value} as any,
      {} as any,
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
});
