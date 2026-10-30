import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { Subject, throwError } from 'rxjs';

import { PostsService } from 'app/posts.services';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let postsService: jasmine.SpyObj<PostsService> & {service_initialized: Subject<boolean>};
  let snackBar: jasmine.SpyObj<MatSnackBar>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    postsService = Object.assign(
      jasmine.createSpyObj<PostsService>('PostsService', ['login', 'register', 'afterLogin']),
      {
        service_initialized: new Subject<boolean>(),
        isLoggedIn: false,
        config: {
          Advanced: {multi_user_mode: true},
          Users: {allow_registration: true}
        }
      }
    );
    snackBar = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    component = new LoginComponent(postsService, snackBar, router);
  });

  afterEach(() => component.ngOnDestroy());

  it('stops observing initialization after the page is destroyed', () => {
    component.ngOnInit();
    postsService.service_initialized.next(true);

    expect(component.registrationEnabled).toBe(true);

    component.ngOnDestroy();
    postsService.config.Users.allow_registration = false;
    postsService.service_initialized.next(true);

    expect(component.initializationRequest).toBeNull();
    expect(component.registrationEnabled).toBe(true);
  });

  it('prevents overlapping login requests and accepts only a confirmed response', () => {
    const response = new Subject<any>();
    postsService.login.and.returnValue(response);
    component.loginUsernameInput = 'synthetic-user';
    component.loginPasswordInput = 'synthetic-password';

    component.login();
    component.login();

    expect(postsService.login).toHaveBeenCalledTimes(1);
    expect(component.loggingIn).toBe(true);

    response.next({
      user: {name: 'synthetic-user'},
      token: 'synthetic-token',
      permissions: [],
      available_permissions: []
    });
    response.complete();

    expect(postsService.afterLogin).toHaveBeenCalledTimes(1);
    expect(component.loggingIn).toBe(false);
  });

  it('keeps registration retryable and does not expose raw server errors', () => {
    const response = new Subject<any>();
    postsService.register.and.returnValues(
      response,
      throwError(() => ({error: '/private/server/path', status: 409}))
    );
    component.registrationUsernameInput = 'synthetic-user';
    component.registrationPasswordInput = 'synthetic-password';
    component.registrationPasswordConfirmationInput = 'synthetic-password';

    component.register();
    component.register();

    expect(postsService.register).toHaveBeenCalledTimes(1);
    expect(component.registering).toBe(true);

    response.error({error: '/private/server/path', status: 409});
    component.register();

    expect(postsService.register).toHaveBeenCalledTimes(2);
    expect(component.registering).toBe(false);
    expect(component.registrationUsernameInput).toBe('synthetic-user');
    expect(snackBar.open).toHaveBeenCalledWith(
      'Could not register the user. The name may already be in use or registration may be disabled.',
      '',
      {duration: 2000}
    );
    expect(snackBar.open.calls.allArgs().flat().join(' ')).not.toContain('/private/server/path');
  });

  it('cancels an active login request when the page is destroyed', () => {
    const response = new Subject<any>();
    postsService.login.and.returnValue(response);
    component.loginUsernameInput = 'synthetic-user';
    component.loginPasswordInput = 'synthetic-password';
    component.login();

    component.ngOnDestroy();
    response.next({token: 'late-token'});

    expect(response.observers.length).toBe(0);
    expect(component.loginRequest).toBeNull();
    expect(component.loggingIn).toBe(false);
    expect(postsService.afterLogin).not.toHaveBeenCalled();
  });
});

describe('LoginComponent registration form', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;

  beforeEach(async () => {
    const postsService = Object.assign(
      jasmine.createSpyObj<PostsService>('PostsService', ['login', 'register', 'afterLogin']),
      {
        service_initialized: new Subject<boolean>(),
        isLoggedIn: false,
        config: {
          Advanced: {multi_user_mode: true},
          Users: {allow_registration: true}
        }
      }
    );

    await TestBed.configureTestingModule({
      declarations: [LoginComponent],
      imports: [
        FormsModule,
        MatButtonModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressBarModule,
        MatTabsModule,
        NoopAnimationsModule
      ],
      providers: [
        {provide: PostsService, useValue: postsService},
        {provide: MatSnackBar, useValue: jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open'])},
        {provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigate'])}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    component.registrationEnabled = true;
    component.selectedTabIndex = 1;
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('submits registration on Enter without submitting when password fields are clicked', () => {
    spyOn(component, 'register');
    const passwordInputs: HTMLInputElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('input[type="password"]')
    );

    expect(passwordInputs.length).toBe(2);

    passwordInputs[0].click();
    expect(component.register).not.toHaveBeenCalled();

    passwordInputs[0].dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter', bubbles: true}));
    expect(component.register).toHaveBeenCalledTimes(1);
  });
});
