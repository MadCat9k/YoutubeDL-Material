import { CustomPlaylistsComponent } from './custom-playlists.component';

describe('CustomPlaylistsComponent', () => {
  it('provides an accessible name for the create-playlist action', () => {
    const component = new CustomPlaylistsComponent({} as any, {} as any, {} as any);

    expect(component.createPlaylistLabel).toBe('Create a playlist');
  });
});
