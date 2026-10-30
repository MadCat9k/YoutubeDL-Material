import { PostsService } from 'app/posts.services';
import { of, Subject, throwError } from 'rxjs';
import { EditCategoryDialogComponent } from './edit-category-dialog.component';

describe('EditCategoryDialogComponent', () => {
  let component: EditCategoryDialogComponent;
  let postsService: any;

  beforeEach(() => {
    postsService = {
      updateCategory: jasmine.createSpy('updateCategory'),
      reloadCategories: jasmine.createSpy('reloadCategories'),
      openSnackBar: jasmine.createSpy('openSnackBar')
    };
    component = new EditCategoryDialogComponent({
      category: {uid: 'category-a', name: 'Synthetic category', rules: [], custom_output: ''}
    }, postsService as PostsService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('provides localized names for category rule actions', () => {
    expect(component.ruleActionLabels).toEqual({
      moveDown: 'Move rule down',
      moveUp: 'Move rule up',
      remove: 'Remove rule',
      add: 'Add rule'
    });
  });

  it('saves and announces an updated category', () => {
    component.category.name = 'Updated category';
    postsService.updateCategory.and.returnValue(of({success: true}));

    component.saveClicked();

    expect(postsService.updateCategory).toHaveBeenCalledOnceWith({
      uid: 'category-a', name: 'Updated category', rules: [], custom_output: ''
    });
    expect(postsService.reloadCategories).toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalledWith('Category updated.');
    expect(component.categoryChanged()).toBeTrue();
    expect(component.updating).toBeFalse();
  });

  it('preserves edits and allows retry after a rejected update', () => {
    component.category.name = 'Updated category';
    postsService.updateCategory.and.returnValue(of({success: false}));

    component.saveClicked();

    expect(postsService.reloadCategories).not.toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not update category. Try again.',
      'Dismiss'
    );
    expect(component.category.name).toBe('Updated category');
    expect(component.categoryChanged()).toBeFalse();
    expect(component.updating).toBeFalse();
  });

  it('preserves edits and allows retry after a failed update request', () => {
    component.category.name = 'Updated category';
    postsService.updateCategory.and.returnValue(throwError(() => new Error('synthetic failure')));

    component.saveClicked();

    expect(postsService.reloadCategories).not.toHaveBeenCalled();
    expect(postsService.openSnackBar).toHaveBeenCalledWith(
      'Could not update category. Try again.',
      'Dismiss'
    );
    expect(component.category.name).toBe('Updated category');
    expect(component.categoryChanged()).toBeFalse();
    expect(component.updating).toBeFalse();
  });

  it('does not start a second category update while one is pending', () => {
    const response = new Subject<any>();
    component.category.name = 'Updated category';
    postsService.updateCategory.and.returnValue(response);

    component.saveClicked();
    component.saveClicked();

    expect(postsService.updateCategory).toHaveBeenCalledTimes(1);
    expect(component.updating).toBeTrue();
  });

  it('records only the submitted snapshot as saved', () => {
    const response = new Subject<any>();
    component.category.name = 'Submitted category';
    postsService.updateCategory.and.returnValue(response);

    component.saveClicked();
    component.category.name = 'Newer edit';
    response.next({success: true});
    response.complete();

    expect(component.original_category.name).toBe('Submitted category');
    expect(component.category.name).toBe('Newer edit');
    expect(component.categoryChanged()).toBeFalse();
  });

  it('ignores a pending category update result after destruction', () => {
    const response = new Subject<any>();
    component.category.name = 'Updated category';
    postsService.updateCategory.and.returnValue(response);

    component.saveClicked();
    component.ngOnDestroy();
    response.next({success: true});

    expect(postsService.reloadCategories).not.toHaveBeenCalled();
    expect(postsService.openSnackBar).not.toHaveBeenCalled();
    expect(component.updating).toBeFalse();
  });
});
