import { Component,
  ChangeDetectorRef,
  Inject,
  Injectable,
  signal,
  PLATFORM_ID
} from '@angular/core';
import { Router, RouterOutlet, RouterLink } from '@angular/router';
import { Institutions, Institution, PartnerLink } from './api/institutions';
import { NgClass, isPlatformBrowser } from '@angular/common';

import { Auth } from './auth'
import { Cookies } from './cookies'


// the level decides the color and icon shown in the notification
export type NotificationLevel = 'error' | 'warning' | 'success';

export interface NotificationItem {
  id: number;
  message: string;
  level: NotificationLevel;
}

// Shared notification service.
@Injectable({ providedIn: 'root' })
export class Notifications {
  // list of notifications currently visible, rendered by app.html
  public list: NotificationItem[] = [];
  private next_id: number = 0;

  // shows a new notification and removes it automatically after a few seconds
  public send(message: string, level: NotificationLevel) : number {
    let id = this.next_id;
    this.next_id = this.next_id + 1;

    let notification: NotificationItem = {
      id: id,
      message: message,
      level: level
    };
    this.list.push(notification);
    return id;
  }

  // removes a single notification from the list
  public dismiss(id: number) {
    let remaining: NotificationItem[] = [];
    for (let notification of this.list) {
      if (notification.id != id) {
        remaining.push(notification);
      }
    }
    this.list = remaining;
  }
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, NgClass],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('frontend');
  constructor(
    private cookie_manager : Cookies,
    private router : Router,
    private cdr : ChangeDetectorRef,
    public notifications : Notifications,
    private institutions : Institutions,
    @Inject(PLATFORM_ID) private platformId: Object
  ){}

  // convenience wrapper so the layout can also raise notifications directly
  public send_notification(message: string, level: NotificationLevel) {
    let id = this.notifications.send(message, level);
    console.warn(message+' '+level);
    this.cdr.markForCheck();

    setTimeout(() => {
      this.notifications.dismiss(id);
      this.cdr.markForCheck();
    }, 4000);
  }

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

      // institution information
      this.institutions.getInstitution(this.user_data.id_institution).subscribe({
        next: res => {
          this.user_data.institution_data = res;
          this.cdr.markForCheck();
        },
        error: err => {
          console.error(err);
        }
      });
    }
  }

  public isLoggedIn : boolean = false;
  user_data : UserData = {
    institution_data: {} as Institution
  } as UserData;

  attempt_logout() {
    if(!isPlatformBrowser(this.platformId)) { return; }
    this.isLoggedIn = false;
    this.cdr.markForCheck();
    this.cookie_manager.deleteCookie('token');
    this.cookie_manager.deleteCookie('user');
    this.router.navigate(['login']);
  }

  links : link[] = [
    {
      text: 'Home',
      href: '/',
      allowed_roles: ['student','staff','referent'],
      loginRequired : false,
      icon: 'mdi mdi-home-outline'
    },
    {
      text: 'Create New Application',
      href: '/form',
      allowed_roles: ['student'],
      loginRequired : true,
      icon: 'mdi mdi-plus-circle-outline'
    },
    {
      text: 'Applications List',
      href: '/applications',
      allowed_roles: ['student','staff','referent'],
      loginRequired : true,
      icon: 'mdi mdi-card-multiple-outline'
    },
    {
      text: 'Manage Users',
      href: '/manage-users',
      allowed_roles: ['staff'],
      loginRequired : true,
      icon: 'mdi mdi-account-cog-outline'
    },
    {
      text: 'Manage Exams',
      href: '/manage-exams',
      allowed_roles: ['staff'],
      loginRequired : true,
      icon: 'mdi mdi-file-cog-outline'
    },
    {
      text: 'Manage Partners',
      href: '/manage-partners',
      allowed_roles: ['staff'],
      loginRequired : true,
      icon: 'mdi mdi-office-building-cog-outline'
    }

  ];

}

interface link {
  text: string;
  href: string;
  allowed_roles: string[];
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
  institution_data: Institution;
}
