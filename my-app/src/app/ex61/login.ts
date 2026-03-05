import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

interface LoginResponse {
  message: string;
  user?: {
    _id: string;
    username: string;
  };
}

interface MeResponse {
  loggedIn: boolean;
  message?: string;
  user?: {
    _id: string;
    username: string;
  };
}

@Component({
  selector: 'app-ex61-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
})
export class Ex61Login implements OnInit {
  username = '';
  password = '';
  statusMessage = '';
  cookieMessage = '';
  currentUser: { _id: string; username: string } | null = null;
  private readonly apiBase = 'http://localhost:3002/api/auth';

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.readLoginCookie(false);
  }

  onLogin(): void {
    if (!this.username || !this.password) {
      this.statusMessage = 'Please enter username and password.';
      return;
    }

    this.http.post<LoginResponse>(
      `${this.apiBase}/login`,
      {
        username: this.username,
        password: this.password,
      },
      { withCredentials: true }
    ).subscribe({
      next: (response) => {
        this.statusMessage = 'Login successful';
        if (response.user) {
          this.currentUser = response.user;
          this.cookieMessage = `Cookie user: ${response.user.username} (id: ${response.user._id})`;
        }
        this.password = '';
        this.readLoginCookie(true);
        this.router.navigate(['/ex61/login-result'], {
          queryParams: {
            status: 'success',
            message: 'Login successful',
            user: response.user?.username || this.username
          }
        });
      },
      error: (error) => {
        const errorMessage = error?.error?.message || 'Login failed.';
        this.statusMessage = errorMessage;
        this.currentUser = null;
        this.cookieMessage = '';
        this.router.navigate(['/ex61/login-result'], {
          queryParams: {
            status: 'fail',
            message: errorMessage
          }
        });
      },
    });
  }

  onLogout(): void {
    this.http.post<{ message: string }>(
      `${this.apiBase}/logout`,
      {},
      { withCredentials: true }
    ).subscribe({
      next: (response) => {
        this.statusMessage = response.message;
        this.currentUser = null;
        this.cookieMessage = 'No login cookie found';
      },
      error: () => {
        this.statusMessage = 'Logout failed.';
      },
    });
  }

  readLoginCookie(fromLoginAction: boolean): void {
    this.http.get<MeResponse>(
      `${this.apiBase}/me?t=${Date.now()}`,
      { withCredentials: true }
    ).subscribe({
      next: (response) => {
        if (response.loggedIn && response.user) {
          this.statusMessage = fromLoginAction ? 'Login successful' : 'Already logged in';
          this.currentUser = response.user;
          this.cookieMessage = `Cookie user: ${response.user.username} (id: ${response.user._id})`;
        } else {
          if (!fromLoginAction) {
            this.statusMessage = '';
          }
          this.currentUser = null;
          this.cookieMessage = response.message || 'No login cookie found';
        }
      },
      error: () => {
        this.currentUser = null;
        this.cookieMessage = 'Cannot read login cookie from server.';
      },
    });
  }
}
