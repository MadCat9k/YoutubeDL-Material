import { CookiesUploaderDialogComponent } from './cookies-uploader-dialog.component';

describe('CookiesUploaderDialogComponent', () => {
  it('provides an accessible name for the upload action', () => {
    const component = new CookiesUploaderDialogComponent({} as any);

    expect(component.uploadLabel).toBe('Upload');
  });
});
