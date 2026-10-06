import { UnifiedFileCardComponent } from './unified-file-card.component';

describe('UnifiedFileCardComponent', () => {
  it('falls back from a missing local thumbnail to the remote URL and then the placeholder', () => {
    const component = new UnifiedFileCardComponent({} as any);
    component.baseStreamPath = 'http://localhost:17442/api/';
    component.jwtString = 'token';
    component.file_obj = {
      uid: 'file-1',
      thumbnailPath: 'subscriptions/sample.webp',
      thumbnailURL: 'https://example.com/remote.jpg',
      duration: 10,
      isAudio: false
    };

    component.ngOnInit();
    expect(component.thumbnailBlobURL).toContain('api/thumbnail/subscriptions%2Fsample.webp');

    component.onThumbnailError();
    expect(component.thumbnailBlobURL).toBe('https://example.com/remote.jpg');

    component.onThumbnailError();
    expect(component.thumbnailBlobURL).toBe(component.thumbnailPlaceholderURL);

    component.onThumbnailError();
    expect(component.thumbnailBlobURL).toBe(component.thumbnailPlaceholderURL);
  });
});
