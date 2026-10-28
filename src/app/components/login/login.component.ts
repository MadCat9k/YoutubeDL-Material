import { Component, OnDestroy, OnInit } from '@angular/core';
import { PostsService } from 'app/posts.services';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, OnDestroy {

  selectedTabIndex = 0;

  // login
  loginUsernameInput = '';
  loginPasswordInput = '';
  loggingIn = false;

  // registration
  registrationEnabled = false;
  registrationUsernameInput = '';
  registrationPasswordInput = '';
  registrationPasswordConfirmationInput = '';
  registering = false;
  initializationRequest: Subscription = null;
  loginRequest: Subscription = null;
  registrationRequest: Subscription = null;

  constructor(private postsService: PostsService, private snackBar: MatSnackBar, private router: Router) { }

  ngOnInit(): void {
    if (this.postsService.isLoggedIn && localStorage.getItem('jwt_token') !== 'null') {
      this.router.navigate(['/home']);
    }
    this.initializationRequest = this.postsService.service_initialized.subscribe(init => {
      if (init) {
        if (!this.postsService.config['Advanced']['multi_user_mode']) {
          this.router.navigate(['/home']);
        }
        this.registrationEnabled = this.postsService.config['Users'] && this.postsService.config['Users']['allow_registration'];
      }
    });
  }

  ngOnDestroy(): void {
    this.initializationRequest?.unsubscribe();
    this.loginRequest?.unsubscribe();
    this.registrationRequest?.unsubscribe();
    this.initializationRequest = null;
    this.loginRequest = null;
    this.registrationRequest = null;
    this.loggingIn = false;
    this.registering = false;
  }

  login() {
    if (this.loginPasswordInput === '' || this.loggingIn) {
      return;
    }
    this.loggingIn = true;
    let request: Subscription = null;
    request = this.postsService.login(this.loginUsernameInput, this.loginPasswordInput).pipe(
      finalize(() => {
        if (this.loginRequest === request) {
          this.loginRequest = null;
          this.loggingIn = false;
        }
      })
    ).subscribe({
      next: res => {
        if (res['token']) {
          this.postsService.afterLogin(res['user'], res['token'], res['permissions'], res['available_permissions']);
        } else {
          this.openSnackBar('Login failed, unknown error.');
        }
      },
      error: err => {
        const error_code = err.status;
        if (error_code === 401) {
          this.openSnackBar('User name or password is incorrect!');
        } else if (error_code === 404) {
          this.openSnackBar('Login failed, cannot connect to the server.');
        } else {
          this.openSnackBar('Login failed, unknown error.');
        }
      }
    });

    if (!request.closed) {
      this.loginRequest = request;
    } else {
      this.loggingIn = false;
    }
  }

  register() {
    if (this.registering) return;

    if (!this.registrationUsernameInput || this.registrationUsernameInput === '') {
      this.openSnackBar('User name is required!');
      return;
    }

    if (!this.registrationPasswordInput || this.registrationPasswordInput === '') {
      this.openSnackBar('Password is required!');
      return;
    }

    if (!this.registrationPasswordConfirmationInput || this.registrationPasswordConfirmationInput === '') {
      this.openSnackBar('Password confirmation is required!');
      return;
    }

    if (this.registrationPasswordInput !== this.registrationPasswordConfirmationInput) {
      this.openSnackBar('Password confirmation is incorrect!');
      return;
    }

    this.registering = true;
    let request: Subscription = null;
    request = this.postsService.register(this.registrationUsernameInput, this.registrationPasswordInput).pipe(
      finalize(() => {
        if (this.registrationRequest === request) {
          this.registrationRequest = null;
          this.registering = false;
        }
      })
    ).subscribe({
      next: res => {
        if (res && res['user']) {
          this.openSnackBar(`User ${res['user']['name']} successfully registered.`);
          this.loginUsernameInput = res['user']['name'];
          this.selectedTabIndex = 0;
        } else {
          this.showRegistrationFailure();
        }
      },
      error: () => this.showRegistrationFailure()
    });

    if (!request.closed) {
      this.registrationRequest = request;
    } else {
      this.registering = false;
    }
  }

  private showRegistrationFailure(): void {
    this.openSnackBar(
      $localize`:@@registration-failed:Could not register the user. The name may already be in use or registration may be disabled.`
    );
  }

  public openSnackBar(message: string, action: string = '') {
    this.snackBar.open(message, action, {
      duration: 2000,
    });
  }

}
