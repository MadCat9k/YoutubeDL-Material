import { PostsService } from 'app/posts.services';
import { EditCategoryDialogComponent } from './edit-category-dialog.component';

describe('EditCategoryDialogComponent', () => {
  let component: EditCategoryDialogComponent;

  beforeEach(() => {
    component = new EditCategoryDialogComponent({
      category: {name: 'Synthetic category', rules: []}
    }, {} as PostsService);
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
});
