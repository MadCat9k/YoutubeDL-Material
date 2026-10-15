import { SortPropertyComponent } from './sort-property.component';

describe('SortPropertyComponent', () => {
  let component: SortPropertyComponent;

  beforeEach(() => {
    component = new SortPropertyComponent();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('provides localized names for the sort controls and current direction', () => {
    expect(component.sortControlLabels.sortBy).toBe('Sort by');
    expect(component.sortDirectionLabel).toBe('Descending order');

    component.descendingMode = false;

    expect(component.sortDirectionLabel).toBe('Ascending order');
  });
});
