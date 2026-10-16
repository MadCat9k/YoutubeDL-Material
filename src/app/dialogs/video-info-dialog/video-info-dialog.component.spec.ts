import { DatePipe } from '@angular/common';
import { PostsService } from 'app/posts.services';
import { VideoInfoDialogComponent } from './video-info-dialog.component';

describe('VideoInfoDialogComponent', () => {
  let component: VideoInfoDialogComponent;

  beforeEach(() => {
    component = new VideoInfoDialogComponent(null, {} as PostsService, {} as DatePipe);
    component.file = {favorite: false} as any;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('provides localized action names that follow editing and favorite state', () => {
    expect(component.editActionLabel).toBe('Edit file information');
    expect(component.favoriteActionLabel).toBe('Add to favorites');
    expect(component.videoInfoActionLabels.openSource).toBe('Open source URL');

    component.editing = true;
    component.file.favorite = true;

    expect(component.editActionLabel).toBe('Stop editing file information');
    expect(component.favoriteActionLabel).toBe('Remove from favorites');
  });
});
