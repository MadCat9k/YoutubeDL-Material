import { of, Subject } from 'rxjs';

import { NotificationsComponent } from './notifications.component';

describe('NotificationsComponent', () => {
  let component: NotificationsComponent;
  let postsService: any;

  beforeEach(() => {
    postsService = {
      initialized: true,
      service_initialized: new Subject<boolean>(),
      getNotifications: jasmine.createSpy('getNotifications'),
      setNotificationsToRead: jasmine.createSpy('setNotificationsToRead'),
      deleteNotification: jasmine.createSpy('deleteNotification'),
      deleteAllNotifications: jasmine.createSpy('deleteAllNotifications')
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

  it('shows a connection error and clears it when retrying', () => {
    const failedResponse = new Subject<any>();
    const retryResponse = new Subject<any>();
    postsService.getNotifications.and.returnValues(failedResponse, retryResponse);

    component.getNotifications();
    failedResponse.error(new Error('request failed'));

    expect(component.notifications_connection_error).toBe(true);

    component.getNotifications();
    expect(component.notifications_connection_error).toBe(false);

    retryResponse.next({notifications: []});
    expect(component.notifications).toEqual([]);
    expect(component.notifications_connection_error).toBe(false);
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

  it('counts only unread notifications', () => {
    component.notifications = [
      {uid: 'unread', read: false},
      {uid: 'history', read: true}
    ] as any;

    expect(component.getUnreadCount()).toBe(1);
  });

  it('removes a notification locally and emits the remaining unread count', () => {
    spyOn(component.notificationCount, 'emit');
    postsService.deleteNotification.and.returnValue(of({success: true}));
    component.notifications = [
      {uid: 'remove-me', read: false},
      {uid: 'remaining-history', read: true}
    ] as any;

    component.deleteNotification('remove-me');

    expect(component.notifications.map(notification => notification.uid)).toEqual(['remaining-history']);
    expect(component.notificationCount.emit).toHaveBeenCalledWith(0);
  });

  it('clears local notifications and the badge only after server success', () => {
    const response = new Subject<any>();
    spyOn(component.notificationCount, 'emit');
    postsService.deleteAllNotifications.and.returnValue(response);
    component.notifications = [{uid: 'unread', read: false}] as any;

    component.deleteAllNotifications();
    expect(component.notifications.length).toBe(1);
    expect(component.notificationCount.emit).not.toHaveBeenCalled();

    response.next({success: true});
    expect(component.notifications).toEqual([]);
    expect(component.notificationCount.emit).toHaveBeenCalledWith(0);
  });
});
