import { Component, ChangeDetectorRef  } from '@angular/core';
import { Auth } from '../auth'
import { Cookies } from '../cookies'

import { App } from '../app'

import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-app-login',
  imports: [FormsModule, CommonModule],
  templateUrl: './app-login.html',
  styleUrl: './app-login.css',
})
export class AppLogin {
  constructor(
    private auth : Auth,
    private router : Router,
    private app : App,
    private cookie_manager : Cookies,
    private cdr : ChangeDetectorRef
  ) {}

  error_message : string = "";
  email : string = "";
  password : string = "";

  attempt_login() {
    this.auth.login(this.email, this.password).subscribe({
      next: async res => {
        await this.offerSaveCredentials(this.email, this.password);
        this.cookie_manager.setCookie('token', res.token, 1);
        this.cookie_manager.setCookie('user', JSON.stringify(res.user), 1);
        this.app.update_data();
        this.router.navigate(['applications']);
        this.cdr.markForCheck();
      },
      error: err => {
        this.error_message = 'invalid username or password';
        this.cdr.markForCheck();
        console.log(err);
      }
    });
  }

  private async offerSaveCredentials(email: string, password: string): Promise<void> {

  }
}
