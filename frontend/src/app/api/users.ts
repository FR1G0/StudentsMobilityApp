import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Cookies } from '../cookies';

@Injectable({
  providedIn: 'root',
})
export class Users {
  base_url = 'http://localhost:5000';

  constructor(
    private http: HttpClient,
    private cookie_manager: Cookies
  ) { }

  // builds the Authorization header using the 'token' cookie
  private authHeaders(): HttpHeaders {
    const token = this.cookie_manager.getCookie('token');
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  // returns a jwt token and the authenticated user info
  login(email: string, password: string): Observable<LoginResponse> {
    const endpoint = this.base_url + '/api/login';
    const payload = { email: email, password: password };
    return this.http.post<LoginResponse>(endpoint, payload);
  }

  // returns the list of all users in the database
  getAllUsers(): Observable<User[]> {
    const endpoint = this.base_url + '/api/user';
    return this.http.get<User[]>(endpoint, { headers: this.authHeaders() });
  }

  // returns the user matching the given id
  getUser(id: number): Observable<User> {
    const endpoint = this.base_url + '/api/user/' + id;
    return this.http.get<User>(endpoint, { headers: this.authHeaders() });
  }

  // returns the list of users whose firstname matches the given name
  getUsersByName(name: string): Observable<User[]> {
    const endpoint = this.base_url + '/api/user/name:' + name;
    return this.http.get<User[]>(endpoint, { headers: this.authHeaders() });
  }

  // returns the user matching the given firstname and lastname
  getUserByNameSurname(name: string, surname: string): Observable<User> {
    const endpoint = this.base_url + '/api/user/' + name + '/' + surname;
    return this.http.get<User>(endpoint, { headers: this.authHeaders() });
  }

  // returns the status of the user insertion
  insertUser(body: UserInsertBody): Observable<StatusResponse> {
    const endpoint = this.base_url + '/api/user/insert';
    return this.http.post<StatusResponse>(endpoint, body, { headers: this.authHeaders() });
  }

  // returns the status of the user update (body must contain "id")
  updateUser(body: UserUpdateBody): Observable<StatusResponse> {
    const endpoint = this.base_url + '/api/user/update';
    return this.http.post<StatusResponse>(endpoint, body, { headers: this.authHeaders() });
  }

  // returns the status of the user deletion
  deleteUser(id: number): Observable<StatusResponse> {
    const endpoint = this.base_url + '/api/user/delete/' + id;
    return this.http.post<StatusResponse>(endpoint, {}, { headers: this.authHeaders() });
  }

  // returns the list of allowed user roles
  getUserRoles(): Observable<string[]> {
    const endpoint = this.base_url + '/api/user/info/role';
    return this.http.get<string[]>(endpoint);
  }
}

export interface User {
  id: number;
  email: string;
  role: string;
  firstname: string;
  lastname: string;
  id_institution: number;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface UserInsertBody {
  email: string;
  password_hash: string;
  role: string;
  firstname: string;
  lastname: string;
  id_institution: number;
}

export interface UserUpdateBody {
  id: number;
  email?: string;
  password_hash?: string;
  firstname?: string;
  lastname?: string;
  id_institution?: number;
}

export interface StatusResponse {
  status: string;
  error?: string;
  id?: number;
}
