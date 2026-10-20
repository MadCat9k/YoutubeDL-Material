import { DatePipe } from '@angular/common';
import { PostsService } from 'app/posts.services';
import { throwError } from 'rxjs';
import { VideoInfoDialogComponent } from './video-info-dialog.component';

describe('VideoInfoDialogComponent', () => {
  let component: VideoInfoDialogComponent;
  let postsService: jasmine.SpyObj<PostsService>;

  beforeEach(() => {
    postsService = jasmine.createSpyObj<PostsService>('PostsService', ['getFile', 'openSnackBar']);
    component = new VideoInfoDialogComponent(null, postsService, {} as DatePipe);
    component.file = {uid: 'synthetic-file', favorite: false} as any;
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

  it('shows a localized error and clears the loading state when refreshing fails', () => {
    postsService.getFile.and.returnValue(throwError(() => new Error('private upstream diagnostic')));

    component.getFile();

    expect(component.retrieving_file).toBeFalse();
    expect(postsService.openSnackBar).toHaveBeenCalledOnceWith(
      'Failed to get file information from the server.',
      'Dismiss'
    );
  });
});
