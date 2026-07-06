import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { App } from '../app';
import { Users, UserInsertBody, UserUpdateBody } from '../api/users';

@Component({
  selector: 'app-manage-users',
  imports: [FormsModule],
  templateUrl: './manage-users.html',
  styleUrl: './manage-users.css',
})
export class ManageUsers implements OnInit {
  constructor(
    private usersApi: Users,
    private app: App,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  isLoading = true;

  // new user form fields
  newEmail = '';
  newFirstname = '';
  newLastname = '';
  newRole = '';
  newPassword = '';

  // allowed roles for the new user select
  roles: string[] = [];

  // users of the staff institution, editable inline in the list
  users: EditableUser[] = [];

  // institution of the logged staff member: created users must belong to it
  get institutionId(): number {
    return this.app.user_data.id_institution;
  }

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) { return; }

    this.usersApi.getUserRoles().subscribe({
      next: res => {
        this.roles = res;
        this.cdr.markForCheck();
      },
      error: err => console.error(err)
    });

    this.loadUsers();
  }

  loadUsers() {
    this.usersApi.getAllUsers().subscribe({
      next: res => {
        // staff members manage only the users of their own institution;
        // the password field starts blank and is sent only when filled in
        this.users = [];
        for (let user of res) {
          if (user.id_institution === this.institutionId) {
            this.users.push({
              id: user.id,
              email: user.email,
              firstname: user.firstname,
              lastname: user.lastname,
              role: user.role,
              password: '',
            });
          }
        }
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.notifyError(err, 'could not load users');
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // creates the new user described by the form (same institution as the staff)
  createUser() {
    if (!this.newEmail || !this.newFirstname || !this.newLastname || !this.newRole || !this.newPassword) {
      this.app.send_notification('all fields are required', 'warning');
      return;
    }

    const body: UserInsertBody = {
      email: this.newEmail,
      password_hash: this.newPassword,
      role: this.newRole,
      firstname: this.newFirstname,
      lastname: this.newLastname,
      id_institution: this.institutionId,
    };

    this.usersApi.insertUser(body).subscribe({
      next: res => {
        if (res.status === 'success') {
          this.app.send_notification('User ' + body.email + ' created', 'success');
          this.newEmail = '';
          this.newFirstname = '';
          this.newLastname = '';
          this.newRole = '';
          this.newPassword = '';
          this.loadUsers();
        } else {
          this.app.send_notification(res.error || 'insert error', 'error');
        }
      },
      error: err => this.notifyError(err, 'insert error'),
      complete: () => this.cdr.markForCheck()
    });
  }

  // applies the inline modifications of a single user row
  modifyUser(user: EditableUser) {
    const body: UserUpdateBody = {
      id: user.id,
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
    };
    // the password input stays blank unless the staff typed a new one
    if (user.password) {
      body.password_hash = user.password;
    }

    this.usersApi.updateUser(body).subscribe({
      next: res => {
        if (res.status === 'success') {
          user.password = '';
          this.app.send_notification('User ' + user.email + ' updated', 'success');
        } else {
          this.app.send_notification(res.error || 'update error', 'error');
        }
      },
      error: err => this.notifyError(err, 'update error'),
      complete: () => this.cdr.markForCheck()
    });
  }

  deleteUser(user: EditableUser) {
    if (!isPlatformBrowser(this.platformId)) { return; }
    const confirmed = window.confirm('Delete user ' + user.email + '? This cannot be undone.');
    if (!confirmed) { return; }

    this.usersApi.deleteUser(user.id).subscribe({
      next: res => {
        if (res.status === 'success') {
          this.users = this.users.filter(u => u.id !== user.id);
          this.app.send_notification('User ' + user.email + ' deleted', 'success');
        } else {
          this.app.send_notification(res.error || 'deleting error', 'error');
        }
      },
      error: err => this.notifyError(err, 'deleting error'),
      complete: () => this.cdr.markForCheck()
    });
  }

  // shows the message returned by the backend when a request fails
  private notifyError(err: any, fallback: string) {
    console.error(err);
    let message = fallback;
    if (err.error && err.error.error) {
      message = err.error.error;
    }
    this.app.send_notification(message, 'error');
  }
}

// a user row of the list; the password starts blank and is used only to change it
interface EditableUser {
  id: number;
  email: string;
  firstname: string;
  lastname: string;
  role: string;
  password: string;
}
