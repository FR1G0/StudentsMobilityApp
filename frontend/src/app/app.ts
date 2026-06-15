import { Component,
  ChangeDetectorRef,
  signal,
  PLATFORM_ID
} from '@angular/core';
import { Router, RouterOutlet, RouterLink } from '@angular/router';
import { NgClass, isPlatformBrowser } from '@angular/common';

import { Auth } from './auth'
import { Cookies } from './cookies'

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('frontend');
  constructor(
    private cookie_manager : Cookies,
    private router : Router,
    private cdr : ChangeDetectorRef
  ){}

  ngOnInit() {
    this.update_data();
  }

  public update_data() {
    let plaintext_user_cookie = this.cookie_manager.getCookie('user');
    if(plaintext_user_cookie != null) {
      this.isLoggedIn = true;
      let obj_user_cookie = JSON.parse(plaintext_user_cookie);

      this.user_data.id = obj_user_cookie.id;
      this.user_data.firstname = obj_user_cookie.firstname;
      this.user_data.lastname = obj_user_cookie.lastname;
      this.user_data.id_institution = obj_user_cookie.id_institution;
      this.user_data.email = obj_user_cookie.email;
      this.user_data.role = obj_user_cookie.role;
    }
  }

  public isLoggedIn : boolean = false;
  user_data : UserData = {} as UserData;

  attempt_logout() {
    this.isLoggedIn = false;
    this.cdr.markForCheck();
    this.cookie_manager.deleteCookie('token');
    this.cookie_manager.deleteCookie('user');
  }

  links : link[] = [
    {
      text: 'Home',
      href: '/home',
      loginRequired : false,
      icon: 'mdi mdi-home-outline'
    },
    {
      text: 'Create New Application',
      href: '/form',
      loginRequired : true,
      icon: 'mdi mdi-plus-circle-outline'
    },
    {
      text: 'Applications List',
      href: '/applications',
      loginRequired : true,
      icon: 'mdi mdi-card-multiple-outline'
    }
  ];
}

interface link {
  text: string;
  href: string;
  loginRequired : boolean;
  icon: string;
}

export interface UserData {
  id: number;
  firstname : string;
  lastname : string;
  role: string;
  email: string;
  id_institution : number;
}
