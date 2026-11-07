import { Subject } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBar } from '@angular/material/snack-bar';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Router } from '@angular/router';

import { AppComponent } from './app.component';
import { PostsService } from './posts.services';

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

describe('AppComponent navigation layout', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;
  let postsService: any;

  beforeEach(async () => {
    postsService = {
      config_reloaded: new Subject<boolean>(),
      open_create_default_admin_dialog: new Subject<boolean>(),
      subscriptions: [
        {id: 'subscription-alpha', name: 'A subscription name that is deliberately long'},
        {id: 'subscription-beta', name: 'Another deliberately long subscription name'}
      ],
      config: {
        Advanced: {multi_user_mode: false},
        Extra: {enable_notifications: false}
      },
      sidepanel_mode: 'side',
      theme: null,
      isLoggedIn: true,
      hasPermission: () => true
    };

    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [MatMenuModule, MatSidenavModule, NoopAnimationsModule],
      providers: [
        {provide: PostsService, useValue: postsService},
        {provide: MatSnackBar, useValue: {}},
        {provide: MatDialog, useValue: {open: () => ({afterClosed: () => new Subject()})}},
        {provide: Router, useValue: {events: new Subject(), url: '/home'}},
        {provide: OverlayContainer, useValue: {getContainerElement: () => document.body}}
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    component.allowSubscriptions = true;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('keeps the side navigation width stable when subscriptions are collapsed', async () => {
    const sidenav = fixture.nativeElement.querySelector('.navigation-sidenav') as HTMLElement;
    const toggle = fixture.nativeElement.querySelector('.subscription-navigation-toggle') as HTMLButtonElement;
    const expandedWidth = sidenav.getBoundingClientRect().width;

    toggle.click();
    await fixture.whenStable();

    expect(expandedWidth).toBeGreaterThan(0);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(sidenav.getBoundingClientRect().width).toBe(expandedWidth);
  });
});
