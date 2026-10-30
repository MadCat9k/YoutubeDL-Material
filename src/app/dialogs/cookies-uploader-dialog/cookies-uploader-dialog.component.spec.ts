import { Subject, of, throwError } from 'rxjs';

import { PostsService } from 'app/posts.services';
import { CookiesUploaderDialogComponent } from './cookies-uploader-dialog.component';

describe('CookiesUploaderDialogComponent', () => {
  let component: CookiesUploaderDialogComponent;
  let postsService: jasmine.SpyObj<PostsService>;

  beforeEach(() => {
    postsService = jasmine.createSpyObj<PostsService>('PostsService', ['uploadCookiesFile', 'openSnackBar']);
    component = new CookiesUploaderDialogComponent(postsService);
  });

  afterEach(() => component.ngOnDestroy());

  it('provides an accessible name for the upload action', () => {
    expect(component.uploadLabel).toBe('Upload');
  });

  it('reports a confirmed upload and prevents duplicate requests', () => {
    const response = new Subject<any>();
    postsService.uploadCookiesFile.and.returnValue(response);
    component.dropped([createDroppedFile()]);

    component.uploadFile();
    component.uploadFile();

    expect(postsService.uploadCookiesFile).toHaveBeenCalledTimes(1);
    response.next({success: true});
    response.complete();

    expect(component.uploaded).toBe(true);
    expect(component.uploading).toBe(false);
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Cookies successfully uploaded!');
  });

  it('keeps rejected and failed uploads retryable without exposing raw errors', () => {
    postsService.uploadCookiesFile.and.returnValues(
      of(null as any),
      throwError(() => new Error('synthetic upload failure'))
    );
    component.dropped([createDroppedFile()]);

    component.uploadFile();
    component.uploadFile();

    expect(postsService.uploadCookiesFile).toHaveBeenCalledTimes(2);
    expect(component.uploaded).toBe(false);
    expect(component.uploading).toBe(false);
    expect(postsService.openSnackBar).toHaveBeenCalledTimes(2);
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not upload cookies. Check the file and try again.',
      'Dismiss'
    );
  });

  it('cancels an active upload when the dialog is destroyed', () => {
    const response = new Subject<any>();
    postsService.uploadCookiesFile.and.returnValue(response);
    component.dropped([createDroppedFile()]);
    component.uploadFile();

    component.ngOnDestroy();
    response.next({success: true});

    expect(response.observers.length).toBe(0);
    expect(component.uploadRequest).toBeNull();
    expect(component.uploading).toBe(false);
    expect(postsService.openSnackBar).not.toHaveBeenCalled();
  });

  function createDroppedFile(): any {
    return {
      relativePath: 'synthetic-cookies.txt',
      fileEntry: {
        isFile: true,
        file: (success: (file: File) => void) => success(new File(['synthetic cookies'], 'synthetic-cookies.txt'))
      }
    };
  }
});
