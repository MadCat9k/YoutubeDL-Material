import { NotificationAction } from 'api-types/models/NotificationAction';

import { NotificationsListComponent } from './notifications-list.component';

describe('NotificationsListComponent', () => {
  let component: NotificationsListComponent;

  beforeEach(() => {
    component = new NotificationsListComponent();
  });

  it('uses a neutral placeholder when notification detail is unavailable', () => {
    expect(component.getNotificationDetail({type: 'download_error', data: null} as any)).toBe('—');
    expect(component.getNotificationDetail({type: 'task_finished', data: {task_title: ''}} as any)).toBe('—');
  });

  it('returns the affected entity detail when present', () => {
    const notification = {type: 'task_finished', data: {task_title: 'Synthetic maintenance task'}} as any;

    expect(component.getNotificationDetail(notification)).toBe('Synthetic maintenance task');
  });

  it('emits labelled notification and remove actions', () => {
    spyOn(component.notificationAction, 'emit');
    spyOn(component.deleteNotification, 'emit');
    const notification = {uid: 'synthetic-notification'} as any;

    component.emitNotificationAction(notification, NotificationAction.VIEW_TASKS);
    component.emitDeleteNotification(notification.uid);

    expect(component.notificationAction.emit).toHaveBeenCalledWith({
      notification,
      action: NotificationAction.VIEW_TASKS
    });
    expect(component.deleteNotification.emit).toHaveBeenCalledWith('synthetic-notification');
  });
});
