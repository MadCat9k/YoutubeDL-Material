import { CustomPlaylistsComponent } from './custom-playlists.component';
import { Subject, of, throwError } from 'rxjs';

describe('CustomPlaylistsComponent', () => {
  let component: CustomPlaylistsComponent;
  let postsService: any;

  beforeEach(() => {
    postsService = {
      downloadPlaylistFromServer: jasmine.createSpy('downloadPlaylistFromServer'),
      openSnackBar: jasmine.createSpy('openSnackBar')
    };
    component = new CustomPlaylistsComponent(postsService, {} as any, {} as any);
  });

  it('provides an accessible name for the create-playlist action', () => {
    expect(component.createPlaylistLabel).toBe('Create a playlist');
  });

  it('downloads a playlist archive and announces the result', () => {
    const archiveBlob = new Blob(['synthetic playlist archive']);
    postsService.downloadPlaylistFromServer.and.returnValue(of(archiveBlob));
    spyOn(component, 'savePlaylistArchive');

    component.downloadPlaylist('playlist-a', 'Synthetic playlist');

    expect(postsService.downloadPlaylistFromServer).toHaveBeenCalledOnceWith('playlist-a');
    expect(component.savePlaylistArchive).toHaveBeenCalledOnceWith(archiveBlob, 'Synthetic playlist');
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Playlist download started.');
    expect(component.downloading_content['playlist-a']).toBeUndefined();
  });

  it('reports a failed playlist request and restores the action', () => {
    postsService.downloadPlaylistFromServer.and.returnValue(throwError(() => new Error('synthetic failure')));
    spyOn(component, 'savePlaylistArchive');

    component.downloadPlaylist('playlist-a', 'Synthetic playlist');

    expect(component.savePlaylistArchive).not.toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not download playlist. Try again.',
      'Dismiss'
    );
    expect(component.downloading_content['playlist-a']).toBeUndefined();
  });

  it('reports a local playlist save failure', () => {
    postsService.downloadPlaylistFromServer.and.returnValue(of(new Blob(['synthetic playlist archive'])));
    spyOn(component, 'savePlaylistArchive').and.throwError('synthetic save failure');

    component.downloadPlaylist('playlist-a', 'Synthetic playlist');

    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not download playlist. Try again.',
      'Dismiss'
    );
    expect(component.downloading_content['playlist-a']).toBeUndefined();
  });

  it('starts only one request for the same playlist while pending', () => {
    const response = new Subject<Blob>();
    postsService.downloadPlaylistFromServer.and.returnValue(response);

    component.downloadPlaylist('playlist-a', 'Synthetic playlist');
    component.downloadPlaylist('playlist-a', 'Synthetic playlist');

    expect(postsService.downloadPlaylistFromServer).toHaveBeenCalledTimes(1);
    expect(component.downloading_content['playlist-a']).toBeTrue();

    response.complete();
    expect(component.downloading_content['playlist-a']).toBeUndefined();
  });

  it('allows different playlists to download concurrently', () => {
    const firstResponse = new Subject<Blob>();
    const secondResponse = new Subject<Blob>();
    postsService.downloadPlaylistFromServer.and.returnValues(firstResponse, secondResponse);

    component.downloadPlaylist('playlist-a', 'Synthetic playlist A');
    component.downloadPlaylist('playlist-b', 'Synthetic playlist B');

    expect(postsService.downloadPlaylistFromServer).toHaveBeenCalledTimes(2);
    expect(component.downloading_content['playlist-a']).toBeTrue();
    expect(component.downloading_content['playlist-b']).toBeTrue();
  });

  it('cancels pending playlist downloads when destroyed', () => {
    const response = new Subject<Blob>();
    postsService.downloadPlaylistFromServer.and.returnValue(response);
    spyOn(component, 'savePlaylistArchive');

    component.downloadPlaylist('playlist-a', 'Synthetic playlist');
    component.ngOnDestroy();
    response.next(new Blob(['late synthetic response']));

    expect(component.savePlaylistArchive).not.toHaveBeenCalled();
    expect(postsService.openSnackBar).not.toHaveBeenCalled();
    expect(component.downloading_content['playlist-a']).toBeUndefined();
  });
});
