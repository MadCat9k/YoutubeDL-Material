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
import { Subject, Subscription } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

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
  pending_task_actions = new Set<TaskType>();
  pending_task_confirmations = new Set<TaskType>();
  pending_task_schedules = new Set<TaskType>();
  resetting_tasks = false;

  private destroyed = new Subject<void>();

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
    this.destroyed.next();
    this.destroyed.complete();
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
    if (this.taskActionPending(task_key)) return;

    const taskToRequireDialog = this.TASKS_TO_REQUIRE_DIALOG[task_key];
    if (taskToRequireDialog) {
      this.pending_task_confirmations.add(task_key);
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        data: {
          dialogTitle: taskToRequireDialog['dialogTitle'],
          dialogText: taskToRequireDialog['dialogText'],
          submitText: taskToRequireDialog['submitText'],
          warnSubmitColor: taskToRequireDialog['warnSubmitColor']
        }
      });
      dialogRef.afterClosed().pipe(
        takeUntil(this.destroyed),
        finalize(() => this.pending_task_confirmations.delete(task_key))
      ).subscribe(confirmed => {
        if (!confirmed) return;

        this.pending_task_confirmations.delete(task_key);
        this._runTask(task_key);
      });
      return;
    }

    this._runTask(task_key);
  }

  _runTask(task_key: TaskType): void {
    if (this.taskActionPending(task_key)) return;

    this.pending_task_actions.add(task_key);
    this.postsService.runTask(task_key).pipe(
      takeUntil(this.destroyed),
      finalize(() => this.pending_task_actions.delete(task_key))
    ).subscribe({
      next: res => {
        if (res['success']) {
          this.getTasks();
          this.getDBBackups();
          this.postsService.openSnackBar($localize`Successfully ran task!`);
        } else {
          this.showTaskActionFailure($localize`:@@task-run-failed:Could not run task. Try again.`);
        }
      },
      error: () => this.showTaskActionFailure($localize`:@@task-run-failed:Could not run task. Try again.`)
    });
  }

  confirmTask(task_key: TaskType): void {
    if (this.taskActionPending(task_key)) return;

    this.pending_task_actions.add(task_key);
    this.postsService.confirmTask(task_key).pipe(
      takeUntil(this.destroyed),
      finalize(() => this.pending_task_actions.delete(task_key))
    ).subscribe({
      next: res => {
        if (res['success']) {
          this.getTasks();
          this.postsService.openSnackBar($localize`Successfully confirmed task!`);
        } else {
          this.showTaskActionFailure($localize`:@@task-confirm-failed:Could not confirm task. Try again.`);
        }
      },
      error: () => this.showTaskActionFailure($localize`:@@task-confirm-failed:Could not confirm task. Try again.`)
    });
  }

  taskActionPending(task_key: TaskType): boolean {
    return this.pending_task_actions.has(task_key) || this.pending_task_confirmations.has(task_key);
  }

  showTaskActionFailure(message: string): void {
    this.postsService.openSnackBar(message, $localize`Dismiss`);
  }

  scheduleTask(task: Task): void {
    if (this.taskSchedulePending(task.key)) return;

    this.pending_task_schedules.add(task.key);
    let updateStarted = false;
    const dialogRef = this.dialog.open(UpdateTaskScheduleDialogComponent, {
      data: {
        task: task
      }
    });
    dialogRef.afterClosed().pipe(
      takeUntil(this.destroyed),
      finalize(() => {
        if (!updateStarted) this.pending_task_schedules.delete(task.key);
      })
    ).subscribe(schedule => {
      if (schedule || schedule === null) {
        updateStarted = true;
        this.postsService.updateTaskSchedule(task.key, schedule).pipe(
          takeUntil(this.destroyed),
          finalize(() => this.pending_task_schedules.delete(task.key))
        ).subscribe({
          next: res => {
            if (res['success']) {
              this.getTasks();
              this.postsService.openSnackBar($localize`:@@task-schedule-success:Task schedule updated.`);
            } else {
              this.showTaskActionFailure($localize`:@@task-schedule-failed:Could not update task schedule. Try again.`);
            }
          },
          error: () => this.showTaskActionFailure($localize`:@@task-schedule-failed:Could not update task schedule. Try again.`)
        });
      }
    });
  }

  taskSchedulePending(task_key: TaskType): boolean {
    return this.pending_task_schedules.has(task_key);
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
    if (this.resetting_tasks) return;

    this.resetting_tasks = true;
    let resetStarted = false;
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        dialogTitle: $localize`Reset tasks`,
        dialogText: $localize`Would you like to reset your tasks? All your schedules will be removed as well.`,
        submitText: $localize`Reset`,
        warnSubmitColor: true
      }
    });
    dialogRef.afterClosed().pipe(
      takeUntil(this.destroyed),
      finalize(() => {
        if (!resetStarted) this.resetting_tasks = false;
      })
    ).subscribe(confirmed => {
      if (confirmed) {
        resetStarted = true;
        this.postsService.resetTasks().pipe(
          takeUntil(this.destroyed),
          finalize(() => this.resetting_tasks = false)
        ).subscribe({
          next: res => {
            if (res['success']) {
              this.getTasks();
              this.getDBBackups();
              this.postsService.openSnackBar($localize`Tasks successfully reset!`);
            } else {
              this.showTaskActionFailure($localize`:@@tasks-reset-failed:Could not reset tasks. Try again.`);
            }
          },
          error: () => this.showTaskActionFailure($localize`:@@tasks-reset-failed:Could not reset tasks. Try again.`)
        });
      } else {
        this.resetting_tasks = false;
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
