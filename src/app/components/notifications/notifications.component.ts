import { Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { Router } from '@angular/router';
import { PostsService } from 'app/posts.services';
import { Notification, NotificationType } from 'api-types';
import { NotificationAction } from 'api-types/models/NotificationAction';
import { MatChipListboxChange } from '@angular/material/chips';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent implements OnInit, OnDestroy {

  notifications: Notification[] = null;
  filtered_notifications: Notification[] = null;
  list_height = '65vh';

  @Output() notificationCount = new EventEmitter<number>();

  notificationFilters: { [key in NotificationType]: {key: string, label: string} } = {
    download_complete: {
      key: 'download_complete',
      label: $localize`Download completed`
    },
    download_error: {
      key: 'download_error',
      label: $localize`Download error`
    },
    task_finished: {
      key: 'task_finished',
      label: $localize`Task`
    },
  };

  selectedFilters = [];
  notifications_connection_error = false;
  initializationSubscription: Subscription = null;
  notificationsRequest: Subscription = null;
  notificationsRequestGeneration = 0;

  constructor(public postsService: PostsService, private router: Router, private elRef: ElementRef) { }

  ngOnInit(): void {
    // wait for init
    if (this.postsService.initialized) {
      this.getNotifications();
    } else {
      const initializationSubscription = this.postsService.service_initialized.subscribe(init => {
        if (init) {
          this.initializationSubscription?.unsubscribe();
          this.initializationSubscription = null;
          this.getNotifications();
        }
      });
      this.initializationSubscription = initializationSubscription.closed ? null : initializationSubscription;
    }
  }

  ngOnDestroy(): void {
    this.notificationsRequestGeneration++;
    this.initializationSubscription?.unsubscribe();
    this.notificationsRequest?.unsubscribe();
    this.initializationSubscription = null;
    this.notificationsRequest = null;
  }

  getNotifications(): void {
    this.notificationsRequest?.unsubscribe();
    const requestGeneration = ++this.notificationsRequestGeneration;
    this.notifications_connection_error = false;
    const notificationsRequest = this.postsService.getNotifications().subscribe(res => {
      if (requestGeneration !== this.notificationsRequestGeneration) return;
      this.notifications = res['notifications'];
      this.notifications.sort((a, b) => b.timestamp - a.timestamp);
      this.notificationCount.emit(this.getUnreadCount());

      this.filterNotifications();
    }, () => {
      if (requestGeneration !== this.notificationsRequestGeneration) return;
      this.notifications_connection_error = true;
    });
    this.notificationsRequest = notificationsRequest.closed ? null : notificationsRequest;
  }

  notificationAction(action_info: {notification: Notification, action: NotificationAction}): void {
    switch (action_info['action']) {
      case NotificationAction.PLAY:
        this.router.navigate(['player', {uid: action_info['notification']['data']['file_uid']}]);
        break;
      case NotificationAction.VIEW_DOWNLOAD_ERROR:
        this.router.navigate(['downloads']);
        break;
      case NotificationAction.RETRY_DOWNLOAD:
        this.postsService.restartDownload(action_info['notification']['data']['download_uid']).subscribe(res => {
          this.postsService.openSnackBar($localize`Download restarted!`);
          this.deleteNotification(action_info['notification']['uid']);
        });
        break;
      case NotificationAction.VIEW_TASKS:
        this.router.navigate(['tasks']);
        break;
      default:
        console.error(`Notification action ${action_info['action']} does not exist!`);
        break;
    }
  }

  deleteNotification(uid: string): void {
    this.postsService.deleteNotification(uid).subscribe(res => {
      this.notifications = (this.notifications || []).filter(notification => notification['uid'] !== uid);
      this.filterNotifications();
      this.notificationCount.emit(this.getUnreadCount());
    });
  }

  deleteAllNotifications(): void {
    this.postsService.deleteAllNotifications().subscribe(res => {
      this.notifications = [];
      this.filtered_notifications = [];
      this.notificationCount.emit(0);
    });
  }

  setNotificationsToRead(): void {
    const uids = (this.notifications || []).filter(notification => !notification.read).map(notification => notification.uid);
    if (uids.length === 0) {
      this.notificationCount.emit(0);
      return;
    }
    this.postsService.setNotificationsToRead(uids).subscribe(res => {
      this.getNotifications();
    });
    this.notificationCount.emit(0);
  }

  filterNotifications(): void {
    this.filtered_notifications = this.notifications.filter(notification => this.selectedFilters.length === 0 || this.selectedFilters.includes(notification.type));
    // We need to do this to get the virtual scroll component to have an appropriate height
    this.calculateListHeight();
  }

  selectedFiltersChanged(event: MatChipListboxChange): void {
    this.selectedFilters = event.value;
    this.filterNotifications();
  }

  calculateListHeight() {
    const avgHeight = 166;
    const calcHeight = this.filtered_notifications.length * avgHeight;
    this.list_height = calcHeight > window.innerHeight*0.65 ? '65vh' : `${calcHeight}px`;
  }

  getUnreadCount(): number {
    return (this.notifications || []).filter(notification => !notification.read).length;
  }

  originalOrder = (): number => {
    return 0;
  }

}
