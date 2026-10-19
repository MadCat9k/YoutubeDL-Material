import { ArchiveViewerComponent } from './archive-viewer.component';

describe('ArchiveViewerComponent', () => {
  it('provides an accessible name for the archive upload action', () => {
    const component = new ArchiveViewerComponent({} as any, {} as any);

    expect(component.uploadLabel).toBe('Upload');
  });
});
