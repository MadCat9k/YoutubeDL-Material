import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Task, TaskType } from 'api-types';
import { PostsService } from 'app/posts.services';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-task-settings',
  templateUrl: './task-settings.component.html',
  styleUrls: ['./task-settings.component.scss']
})
export class TaskSettingsComponent implements OnInit, OnDestroy {
  task_key: TaskType;
  new_options = {};
  task: Task = null;
  saving = false;

  private destroyed = new Subject<void>();

  constructor(private postsService: PostsService, @Inject(MAT_DIALOG_DATA) public data: {task: Task}) {
    this.task_key = this.data.task.key;
    this.task = this.data.task;
    if (!this.task.options) {
      this.task.options = {};
    }
  }

  ngOnInit(): void {
    this.getSettings();
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  getSettings(): void {
    this.postsService.getTask(this.task_key).pipe(takeUntil(this.destroyed)).subscribe(res => {
      this.task = res['task'];
      this.new_options = JSON.parse(JSON.stringify(this.task['options'])) || {};
    });
  }

  saveSettings(): void {
    if (this.saving || !this.optionsChanged()) return;

    const submittedOptions = JSON.parse(JSON.stringify(this.new_options));
    this.saving = true;
    this.postsService.updateTaskOptions(this.task_key, submittedOptions).pipe(
      takeUntil(this.destroyed),
      finalize(() => this.saving = false)
    ).subscribe({
      next: res => {
        if (res['success']) {
          this.task.options = submittedOptions;
          this.postsService.openSnackBar($localize`:@@task-settings-save-success:Task settings saved.`);
        } else {
          this.showSaveFailure();
        }
      },
      error: () => this.showSaveFailure()
    });
  }

  showSaveFailure(): void {
    this.postsService.openSnackBar(
      $localize`:@@task-settings-save-failed:Could not save task settings. Try again.`,
      $localize`Dismiss`
    );
  }

  optionsChanged(): boolean {
    return JSON.stringify(this.new_options) !== JSON.stringify(this.task.options);
  }
}
