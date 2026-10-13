import { UnifiedFileCardComponent } from './unified-file-card.component';

describe('UnifiedFileCardComponent', () => {
  it('requests a local thumbnail and falls back to the remote URL and then the placeholder', () => {
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
    expect(component.thumbnailBlobURL).toContain('api/thumbnail/file/file-1');

    component.onThumbnailError();
    expect(component.thumbnailBlobURL).toBe('https://example.com/remote.jpg');

    component.onThumbnailError();
    expect(component.thumbnailBlobURL).toBe(component.thumbnailPlaceholderURL);

    component.onThumbnailError();
    expect(component.thumbnailBlobURL).toBe(component.thumbnailPlaceholderURL);
  });

  it('requests a local thumbnail without a remote URL and defaults to the placeholder', () => {
    const component = new UnifiedFileCardComponent({} as any);
    component.baseStreamPath = 'http://localhost:17442/api/';
    component.file_obj = {
      uid: 'file-local',
      thumbnailPath: 'video/sample.webp',
      duration: 10,
      isAudio: false
    };

    component.ngOnInit();
    expect(component.thumbnailBlobURL).toContain('api/thumbnail/file/file-local');

    component.file_obj = {duration: 10, isAudio: false};
    component.ngOnChanges({file_obj: {} as any});
    expect(component.thumbnailBlobURL).toBe(component.thumbnailPlaceholderURL);
  });

  it('emits navigation for middle-click but ignores right-click', () => {
    const component = new UnifiedFileCardComponent({} as any);
    component.file_obj = {uid: 'file-1'};
    const emitted = [];
    component.goToFile.subscribe(value => emitted.push(value));

    component.navigateOnAuxClick({button: 2});
    expect(emitted.length).toBe(0);

    const middleClick = {button: 1};
    component.navigateOnAuxClick(middleClick);
    expect(emitted).toEqual([{file: component.file_obj, event: middleClick}]);
  });
});
