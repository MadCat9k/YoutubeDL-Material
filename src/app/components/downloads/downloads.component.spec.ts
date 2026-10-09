import { Clipboard } from '@angular/cdk/clipboard';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { PostsService } from 'app/posts.services';
import { DownloadsComponent } from './downloads.component';

describe('DownloadsComponent', () => {
  let component: DownloadsComponent;

  beforeEach(() => {
    component = new DownloadsComponent(
      {} as PostsService,
      {} as Router,
      {} as MatDialog,
      {} as Clipboard
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('preserves valid falsy download values while merging updates', () => {
    const existing = [{
      uid: 'synthetic-download',
      title: 'Previous title',
      step_index: 1,
      percent_complete: 12,
      paused: true,
      obsolete: 'remove me'
    }];
    const update = [{
      uid: 'synthetic-download',
      title: '',
      step_index: 0,
      percent_complete: 0,
      paused: false
    }];

    const result = component.combineDownloads(existing as any, update as any);

    expect(result as any).toEqual([{
      uid: 'synthetic-download',
      title: '',
      step_index: 0,
      percent_complete: 0,
      paused: false
    }]);
  });

  it('uses compact columns and the action menu below the mobile breakpoint', () => {
    component.innerWidth = 455;

    component.recalculateColumns();

    expect(component.displayedColumns).toEqual(['title', 'percent_complete', 'actions']);
    expect(component.actionsFlex).toBe(1);
    expect(component.minimizeButtons).toBe(true);
  });
});
