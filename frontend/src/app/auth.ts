import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';

import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  base_url = 'http://localhost:5000';
  constructor(private http: HttpClient) { }


  login(email_address: string, password: string) : Observable<any> {
    let full_url = this.base_url+`/api/login`;
    return this.http.post<any>(full_url, {
      email: email_address,
      password: password
    })
  }

}
