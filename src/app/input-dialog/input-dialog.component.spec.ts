import { EventEmitter } from '@angular/core';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { InputDialogComponent } from './input-dialog.component';

describe('InputDialogComponent', () => {
  let component: InputDialogComponent;
  let fixture: ComponentFixture<InputDialogComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [InputDialogComponent],
      imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule,
        MatProgressSpinnerModule, NoopAnimationsModule],
      providers: [
        {provide: MAT_DIALOG_DATA, useValue: {inputTitle: 'Rename item', inputPlaceholder: 'Name', submitText: 'Save'}},
        {provide: MatDialogRef, useValue: jasmine.createSpyObj<MatDialogRef<InputDialogComponent>>('MatDialogRef', ['close'])}
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(InputDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the prompt as a persistent form-field label', () => {
    const element: HTMLElement = fixture.nativeElement;
    const label = element.querySelector('mat-label');
    const input = element.querySelector('input');

    expect(label.textContent.trim()).toBe('Name');
    expect(input.hasAttribute('placeholder')).toBe(false);
  });

  it('prevents duplicate emitter submissions while pending', () => {
    component.doneEmitter = new EventEmitter<string>();
    component.onlyEmitOnDone = true;
    component.inputText = 'Synthetic name';
    spyOn(component.doneEmitter, 'emit');

    component.enterPressed();
    component.enterPressed();

    expect(component.doneEmitter.emit).toHaveBeenCalledOnceWith('Synthetic name');
    expect(component.inputSubmitted).toBeTrue();
  });

  it('re-enables submission when pending state is cleared', () => {
    component.setPending(true);
    component.inputText = 'Synthetic name';
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    expect(input.readOnly).toBeTrue();
    expect(buttons.every(button => button.disabled)).toBeTrue();

    component.setPending(false);
    fixture.detectChanges();

    expect(input.readOnly).toBeFalse();
    expect(buttons.every(button => !button.disabled)).toBeTrue();
  });
});
