import { Component, OnDestroy, OnInit, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { PostsService } from 'app/posts.services';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-edit-category-dialog',
  templateUrl: './edit-category-dialog.component.html',
  styleUrls: ['./edit-category-dialog.component.scss']
})
export class EditCategoryDialogComponent implements OnInit, OnDestroy {

  updating = false;
  original_category = null;
  category = null;
  private destroyed = new Subject<void>();

  ruleActionLabels = {
    moveDown: $localize`:Move category rule down action@@categoryMoveRuleDownAction:Move rule down`,
    moveUp: $localize`:Move category rule up action@@categoryMoveRuleUpAction:Move rule up`,
    remove: $localize`:Remove category rule action@@categoryRemoveRuleAction:Remove rule`,
    add: $localize`:Add category rule action@@categoryAddRuleAction:Add rule`
  };

  propertyOptions = [
    {
      value: 'fulltitle',
      label: 'Title'
    },
    {
      value: 'id',
      label: 'ID'
    },
    {
      value: 'webpage_url',
      label: 'URL'
    },
    {
      value: 'view_count',
      label: 'Views'
    },
    {
      value: 'uploader',
      label: 'Uploader'
    },
    {
      value: '_filename',
      label: 'File Name'
    },
    {
      value: 'tags',
      label: 'Tags'
    }
  ];

  comparatorOptions = [
    {
      value: 'includes',
      label: 'includes'
    },
    {
      value: 'not_includes',
      label: 'not includes'
    },
    {
      value: 'equals',
      label: 'equals'
    },
    {
      value: 'not_equals',
      label: 'not equals'
    },

  ];

  constructor(@Inject(MAT_DIALOG_DATA) public data: any, private postsService: PostsService) {
    if (this.data) {
      this.original_category = this.data.category;
      this.category = JSON.parse(JSON.stringify(this.original_category));
    }
  }

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  addNewRule() {
    this.category['rules'].push({
      preceding_operator: 'or',
      property: 'fulltitle',
      comparator: 'includes',
      value: ''
    });
  }

  saveClicked(): void {
    if (this.updating || this.categoryChanged() || !this.category['name']) return;

    const submittedCategory = JSON.parse(JSON.stringify(this.category));
    this.updating = true;
    this.postsService.updateCategory(submittedCategory).pipe(
      takeUntil(this.destroyed),
      finalize(() => this.updating = false)
    ).subscribe({
      next: res => {
        if (!res['success']) {
          this.showUpdateFailure();
          return;
        }

        this.original_category = submittedCategory;
        this.postsService.reloadCategories();
        this.postsService.openSnackBar($localize`:@@category-update-success:Category updated.`);
      },
      error: () => this.showUpdateFailure()
    });
  }

  private showUpdateFailure(): void {
    this.postsService.openSnackBar(
      $localize`:@@category-update-failed:Could not update category. Try again.`,
      'Dismiss'
    );
  }

  categoryChanged() {
    return JSON.stringify(this.category) === JSON.stringify(this.original_category);
  }

  swapRules(original_index, new_index) {
    [this.category.rules[original_index], this.category.rules[new_index]] = [this.category.rules[new_index],
                                                                            this.category.rules[original_index]];
  }

  removeRule(index) {
    this.category['rules'].splice(index, 1);
  }

}
