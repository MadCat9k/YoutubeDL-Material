import { Subject, throwError } from 'rxjs';

import { CreatePlaylistComponent } from './create-playlist.component';

describe('CreatePlaylistComponent', () => {
  let component: CreatePlaylistComponent;
  let dialogRef: jasmine.SpyObj<any>;
  let postsService: jasmine.SpyObj<any>;

  beforeEach(() => {
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    postsService = jasmine.createSpyObj('PostsService', ['createPlaylist', 'updatePlaylist', 'getPlaylist', 'openSnackBar']);
    postsService.playlists_changed = new Subject<boolean>();
    component = new CreatePlaylistComponent({create_mode: true}, postsService, dialogRef);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows a safe failure message and leaves the dialog open when creation fails', () => {
    postsService.createPlaylist.and.returnValue(throwError(() => new Error('private upstream diagnostic')));
    component.name = 'Synthetic playlist';
    component.filesSelect.setValue(['synthetic-file']);

    component.createPlaylist();

    expect(component.create_in_progress).toBe(false);
    expect(postsService.openSnackBar).toHaveBeenCalledWith('ERROR: failed to create playlist!');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('shows a safe failure and does not mark the playlist updated when saving fails', () => {
    postsService.updatePlaylist.and.returnValue(throwError(() => new Error('private upstream diagnostic')));
    component.playlist = {name: 'Old name', uids: ['old-file']} as any;
    component.name = 'New name';
    component.filesSelect.setValue(['new-file']);

    component.updatePlaylist();

    expect(component.create_in_progress).toBeFalse();
    expect(component.playlist_updated).toBeFalse();
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Failed to load playlist!');
    expect(postsService.getPlaylist).not.toHaveBeenCalled();
  });
});
