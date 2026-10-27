import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { SortPropertyComponent } from './sort-property.component';

describe('SortPropertyComponent', () => {
  let component: SortPropertyComponent;
  let fixture: ComponentFixture<SortPropertyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SortPropertyComponent],
      imports: [
        FormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatSelectModule,
        NoopAnimationsModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SortPropertyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
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

  it('keeps the direction button in the sort control layout', () => {
    const control: HTMLElement = fixture.nativeElement.querySelector('.sort-property-control');
    const direction: HTMLElement = fixture.nativeElement.querySelector('.sort-dir-div');

    expect(getComputedStyle(control).display).toBe('flex');
    expect(getComputedStyle(direction).position).not.toBe('absolute');
  });
});
