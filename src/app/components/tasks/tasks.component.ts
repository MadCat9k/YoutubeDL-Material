import { Component, EventEmitter, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { ConfirmDialogComponent } from 'app/dialogs/confirm-dialog/confirm-dialog.component';
import { RestoreDbDialogComponent } from 'app/dialogs/restore-db-dialog/restore-db-dialog.component';
import { UpdateTaskScheduleDialogComponent } from 'app/dialogs/update-task-schedule-dialog/update-task-schedule-dialog.component';
import { PostsService } from 'app/posts.services';
import { Task, TaskType } from 'api-types';
import { TaskSettingsComponent } from '../task-settings/task-settings.component';
import { Clipboard } from '@angular/cdk/clipboard';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-tasks',
  templateUrl: './tasks.component.html',
  styleUrls: ['./tasks.component.scss']
})
export class TasksComponent implements OnInit, OnDestroy {

  interval_id = null;
  initialization_subscription: Subscription = null;
  tasks_request_subscription: Subscription = null;
  polling_stopped = false;
  tasks_request_in_flight = false;
  tasks_connection_error = false;
  consecutive_poll_failures = 0;
  tasks_check_interval = 1500;
  tasks: Task[] = null;
  tasks_retrieved = false;
  compactView = false;

  displayedColumns: string[] = ['title', 'last_ran', 'last_confirmed', 'status', 'actions'];
  dataSource = null;

  db_backups = [];

  TASKS_TO_REQUIRE_DIALOG: { [key in TaskType]? : {dialogTitle: string, dialogText: string, submitText: string, warnSubmitColor: boolean}} = {
    [TaskType.REBUILD_DATABASE]: {
      dialogTitle: $localize`Rebuild database`,
      dialogText: $localize`Are you sure you want to rebuild the database? All missing users, subscriptions, and files will be reimported. Note that if missing users are detected, they will be created with the password: 'password'. A backup of your current database will be created.`,
      submitText: $localize`Rebuild database`,
      warnSubmitColor: false
    }
  }

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(private postsService: PostsService, private dialog: MatDialog, private clipboard: Clipboard) { }

  ngOnInit(): void {
    this.updateLayout(window.innerWidth);
    if (this.postsService.initialized) {
      this.getTasksRecurring();
    } else {
      this.initialization_subscription = this.postsService.service_initialized.subscribe(init => {
        if (init) {
          this.initialization_subscription?.unsubscribe();
          this.initialization_subscription = null;
          this.getTasksRecurring();
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.polling_stopped = true;
    this.initialization_subscription?.unsubscribe();
    this.tasks_request_subscription?.unsubscribe();
    this.tasks_request_subscription = null;
    this.tasks_request_in_flight = false;
    if (this.interval_id) { clearTimeout(this.interval_id) }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateLayout(window.innerWidth);
  }

  updateLayout(viewportWidth: number): void {
    this.compactView = viewportWidth < 650;
  }

  getTasksRecurring(): void {
    this.polling_stopped = false;
    this.pollTasks();
  }

  pollTasks(): void {
    this.getTasks(true);
  }

  getTasks(scheduleNextPoll = false): void {
    if (this.tasks_request_in_flight) return;

    this.tasks_request_in_flight = true;
    const requestSubscription = this.postsService.getTasks().subscribe(res => {
      if (!Array.isArray(res['tasks'])) {
        this.markTasksRefreshFailed();
        this.tasks_retrieved = true;
        return;
      }

      const nextTasks = res['tasks'];
      for (const task of nextTasks) {
        if (task.title.includes('youtube-dl')) {
          task.title = task.title.replace('youtube-dl', this.postsService.config.Advanced.default_downloader);
        }
      }

      this.tasks_connection_error = false;
      this.consecutive_poll_failures = 0;
      if (JSON.stringify(this.tasks) !== JSON.stringify(nextTasks)) {
        this.tasks = nextTasks;
        if (this.dataSource) {
          this.dataSource.data = this.tasks;
        } else {
          this.dataSource = new MatTableDataSource<Task>(this.tasks);
          this.dataSource.paginator = this.paginator;
          this.dataSource.sort = this.sort;
        }
      }
      this.tasks_retrieved = true;
    }, () => {
      this.markTasksRefreshFailed();
      this.tasks_retrieved = true;
      this.finishTasksRequest(scheduleNextPoll);
    }, () => {
      this.finishTasksRequest(scheduleNextPoll);
    });
    this.tasks_request_subscription = requestSubscription.closed ? null : requestSubscription;
  }

  markTasksRefreshFailed(): void {
    this.tasks_connection_error = true;
    this.consecutive_poll_failures += 1;
  }

  finishTasksRequest(scheduleNextPoll: boolean): void {
    this.tasks_request_subscription = null;
    this.tasks_request_in_flight = false;
    if (scheduleNextPoll && !this.polling_stopped) {
      this.interval_id = setTimeout(() => this.pollTasks(), this.getNextPollDelay());
    }
  }

  getNextPollDelay(): number {
    if (!this.tasks_connection_error) return this.tasks_check_interval;
    const backoffMultiplier = Math.pow(2, Math.min(this.consecutive_poll_failures, 5));
    return Math.min(this.tasks_check_interval * backoffMultiplier, 30000);
  }

  runTask(task_key: TaskType): void {
    const taskToRequireDialog = this.TASKS_TO_REQUIRE_DIALOG[task_key];
    if (taskToRequireDialog) {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        data: {
          dialogTitle: taskToRequireDialog['dialogTitle'],
          dialogText: taskToRequireDialog['dialogText'],
          submitText: taskToRequireDialog['submitText'],
          warnSubmitColor: taskToRequireDialog['warnSubmitColor']
        }
      });
      dialogRef.afterClosed().subscribe(confirmed => {
        if (confirmed) {
          this._runTask(task_key);
        }
      });
      return;
    }

    this._runTask(task_key);
  }

  _runTask(task_key: TaskType): void {
    this.postsService.runTask(task_key).subscribe(res => {
      this.getTasks();
      this.getDBBackups();
      if (res['success']) this.postsService.openSnackBar($localize`Successfully ran task!`);
      else this.postsService.openSnackBar($localize`Failed to run task!`);
    }, err => {
      this.postsService.openSnackBar($localize`Failed to run task!`);
      console.error(err);
    });
  }

  confirmTask(task_key: TaskType): void {
    this.postsService.confirmTask(task_key).subscribe(res => {
      this.getTasks();
      if (res['success']) this.postsService.openSnackBar($localize`Successfully confirmed task!`);
      else this.postsService.openSnackBar($localize`Failed to confirm task!`);
    }, err => {
      this.postsService.openSnackBar($localize`Failed to confirm task!`);
      console.error(err);
    });
  }

  scheduleTask(task: Task): void {
    // open dialog
    const dialogRef = this.dialog.open(UpdateTaskScheduleDialogComponent, {
      data: {
        task: task
      }
    });
    dialogRef.afterClosed().subscribe(schedule => {
      if (schedule || schedule === null) {
        this.postsService.updateTaskSchedule(task['key'], schedule).subscribe(res => {
          this.getTasks();
        });
      }
    });
  }

  openTaskSettings(task: Task): void {
    this.dialog.open(TaskSettingsComponent, {
      data: {
        task: task
      }
    });
  }

  getDBBackups(): void {
    this.postsService.getDBBackups().subscribe(res => {
      this.db_backups = res['db_backups'];
    });
  }

  openRestoreDBBackupDialog(): void {
    this.dialog.open(RestoreDbDialogComponent, {
      data: {
        db_backups: this.db_backups
      },
      width: '80vw'
    })
  }

  resetTasks(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        dialogTitle: $localize`Reset tasks`,
        dialogText: $localize`Would you like to reset your tasks? All your schedules will be removed as well.`,
        submitText: $localize`Reset`,
        warnSubmitColor: true
      }
    });
    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.postsService.resetTasks().subscribe(res => {
          if (res['success']) {
            this.postsService.openSnackBar($localize`Tasks successfully reset!`);
          } else {
            this.postsService.openSnackBar($localize`Failed to reset tasks!`);
          }
        }, err => {
          this.postsService.openSnackBar($localize`Failed to reset tasks!`);
          console.error(err);
        });
      }
    });
  }

  showError(task: Task): void {
    const copyToClipboardEmitter = new EventEmitter<boolean>();
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        dialogTitle: $localize`Error for: ${task['title']}`,
        dialogText: task['error'],
        submitText: $localize`Copy to clipboard`,
        cancelText: $localize`Close`,
        closeOnSubmit: false,
        onlyEmitOnDone: true,
        doneEmitter: copyToClipboardEmitter
      }
    });
    copyToClipboardEmitter.subscribe((done: boolean) => {
      if (done) {
        this.postsService.openSnackBar($localize`Copied to clipboard!`);
        this.clipboard.copy(task['error']);
      }
    });
  }
}
