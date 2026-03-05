import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-ex61-login-result',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './login-result.html',
})
export class Ex61LoginResult {
  status = 'fail';
  message = 'Login failed';
  user = '';
  checkedAt = new Date().toLocaleString();

  constructor(private route: ActivatedRoute) {
    this.route.queryParamMap.subscribe((params) => {
      this.status = params.get('status') || 'fail';
      this.message = params.get('message') || 'Login failed';
      this.user = params.get('user') || '';
      this.checkedAt = new Date().toLocaleString();
    });
  }

  get isSuccess(): boolean {
    return this.status === 'success';
  }
}
