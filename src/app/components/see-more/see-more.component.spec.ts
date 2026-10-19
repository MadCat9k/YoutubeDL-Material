import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { LinkifyPipe, SeeMoreComponent } from './see-more.component';

describe('SeeMoreComponent', () => {
  let component: SeeMoreComponent;
  let fixture: ComponentFixture<SeeMoreComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [SeeMoreComponent, LinkifyPipe]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SeeMoreComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses a native disclosure button and reports its expanded state', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.see-more-toggle');

    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.textContent.trim()).toBe('See more.');

    button.click();
    fixture.detectChanges();

    expect(component.see_more_active).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.textContent.trim()).toBe('See less.');
  });
});
