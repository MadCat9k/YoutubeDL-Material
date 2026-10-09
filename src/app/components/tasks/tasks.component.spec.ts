import { Clipboard } from '@angular/cdk/clipboard';
import { MatDialog } from '@angular/material/dialog';

import { PostsService } from 'app/posts.services';
import { TasksComponent } from './tasks.component';

describe('TasksComponent', () => {
  let component: TasksComponent;

  beforeEach(() => {
    component = new TasksComponent(
      {} as PostsService,
      {} as MatDialog,
      {} as Clipboard
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses the compact task layout at representative narrow widths', () => {
    [320, 375, 455, 649].forEach(viewportWidth => {
      component.updateLayout(viewportWidth);

      expect(component.compactView).withContext(`${viewportWidth}px viewport`).toBe(true);
    });
  });

  it('uses the table layout at and above the mobile breakpoint', () => {
    component.updateLayout(650);

    expect(component.compactView).toBe(false);
  });
});
