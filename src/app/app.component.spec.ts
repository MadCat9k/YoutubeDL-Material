import { Subject } from 'rxjs';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let component: AppComponent;
  let postsService: any;

  beforeEach(() => {
    postsService = {
      config_reloaded: new Subject<boolean>(),
      subscriptions: []
    };
    component = new AppComponent(
      postsService,
      {} as any,
      {} as any,
      {events: new Subject(), url: '/home'} as any,
      {} as any,
      {} as any
    );
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('filters subscriptions by name without case sensitivity', () => {
    postsService.subscriptions = [
      {id: 'subscription-alpha', name: 'Alpha Channel'},
      {id: 'subscription-beta', name: 'Beta Archive'}
    ];
    component.subscriptionSearchTerm = 'ALPHA';

    expect(component.getFilteredSubscriptions()).toEqual([
      {id: 'subscription-alpha', name: 'Alpha Channel'}
    ]);
  });

  it('returns every subscription for an empty search', () => {
    postsService.subscriptions = [
      {id: 'subscription-alpha', name: 'Alpha Channel'},
      {id: 'subscription-beta', name: 'Beta Archive'}
    ];
    component.subscriptionSearchTerm = '   ';

    expect(component.getFilteredSubscriptions()).toEqual(postsService.subscriptions);
  });

  it('handles subscription records without a visible name', () => {
    postsService.subscriptions = [{id: 'subscription-unnamed'}];
    component.subscriptionSearchTerm = 'missing';

    expect(component.getFilteredSubscriptions()).toEqual([]);
  });

  it('allows the subscription section to be collapsed and expanded', () => {
    expect(component.subscriptionsExpanded).toBe(true);

    component.toggleSubscriptions();
    expect(component.subscriptionsExpanded).toBe(false);

    component.toggleSubscriptions();
    expect(component.subscriptionsExpanded).toBe(true);
  });

  it('provides accessible names for top-bar navigation actions', () => {
    expect(component.navigationActionLabels).toEqual({
      toggleSideNavigation: 'Toggle side navigation',
      back: 'Back'
    });
  });
});
