import { Subject } from 'rxjs';

import { NotificationsComponent } from './notifications.component';

describe('NotificationsComponent', () => {
  let component: NotificationsComponent;
  let postsService: any;

  beforeEach(() => {
    postsService = {
      initialized: true,
      service_initialized: new Subject<boolean>(),
      getNotifications: jasmine.createSpy('getNotifications'),
      setNotificationsToRead: jasmine.createSpy('setNotificationsToRead')
    };
    component = new NotificationsComponent(postsService, {} as any, {} as any);
  });

  it('cancels a superseded notification request and ignores its result', () => {
    const firstResponse = new Subject<any>();
    const secondResponse = new Subject<any>();
    postsService.getNotifications.and.returnValues(firstResponse, secondResponse);

    component.getNotifications();
    component.getNotifications();
    firstResponse.next({notifications: [{uid: 'stale', timestamp: 1, read: false}]});
    secondResponse.next({notifications: [{uid: 'current', timestamp: 2, read: false}]});

    expect(firstResponse.observers.length).toBe(0);
    expect(component.notifications.map(notification => notification.uid)).toEqual(['current']);
  });

  it('releases initialization and active request subscriptions on destruction', () => {
    const response = new Subject<any>();
    postsService.initialized = false;
    postsService.getNotifications.and.returnValue(response);

    component.ngOnInit();
    postsService.service_initialized.next(true);
    component.ngOnDestroy();

    expect(postsService.service_initialized.observers.length).toBe(0);
    expect(response.observers.length).toBe(0);
    expect(component.notificationsRequest).toBeNull();
  });

  it('safely closes before notifications have loaded', () => {
    spyOn(component.notificationCount, 'emit');

    component.setNotificationsToRead();

    expect(postsService.setNotificationsToRead).not.toHaveBeenCalled();
    expect(component.notificationCount.emit).toHaveBeenCalledWith(0);
  });
});
