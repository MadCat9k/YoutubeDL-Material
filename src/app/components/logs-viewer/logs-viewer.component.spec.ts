import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { PostsService } from '../../posts.services';
import { LogsViewerComponent } from './logs-viewer.component';

describe('LogsViewerComponent', () => {
  let component: LogsViewerComponent;
  let fixture: ComponentFixture<LogsViewerComponent>;
  let postsService: jasmine.SpyObj<PostsService>;

  beforeEach(waitForAsync(() => {
    postsService = jasmine.createSpyObj<PostsService>('PostsService', ['getLogs', 'openSnackBar', 'clearAllLogs']);
    postsService.getLogs.and.returnValue(of({logs: 'INFO first\nERROR second'}));

    TestBed.configureTestingModule({
      declarations: [LogsViewerComponent],
      imports: [CommonModule, FormsModule, MatFormFieldModule, MatSelectModule, NoopAnimationsModule],
      providers: [
        {provide: PostsService, useValue: postsService},
        {provide: MatDialog, useValue: jasmine.createSpyObj<MatDialog>('MatDialog', ['open'])}
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(LogsViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(postsService.getLogs).toHaveBeenCalledWith(50);
  });

  it('lets the settings page own scrolling and keeps controls in a responsive toolbar', () => {
    const element: HTMLElement = fixture.nativeElement;
    const output = element.querySelector('.logs-output') as HTMLElement;

    expect(output.style.height).toBe('');
    expect(output.style.overflowY).toBe('');
    expect(element.querySelectorAll('.logs-output .example-item').length).toBe(2);
    expect(element.querySelector('.logs-toolbar')).not.toBeNull();
    expect(element.querySelector('.logs-actions')).not.toBeNull();
  });
});
