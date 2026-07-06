import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Cookies } from '../cookies';
import { StatusResponse, User } from './users';
import { Exam } from './exams';

@Injectable({
  providedIn: 'root',
})
export class Institutions {
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

  // returns the information associated to the institution
  getInstitution(id: number): Observable<Institution> {
    const endpoint = this.base_url + '/api/institution/info/' + id;
    return this.http.get<Institution>(endpoint, { headers: this.authHeaders() })
  }

  // returns the status of the institution insertion (staff only)
  insertInstitution(body: InstitutionInsertBody): Observable<StatusResponse> {
    const endpoint = this.base_url + '/api/institution/insert';
    return this.http.post<StatusResponse>(endpoint, body, { headers: this.authHeaders() });
  }

  // returns the status of the institution update (staff only)
  updateInstitution(id: number, body: InstitutionUpdateBody): Observable<StatusResponse> {
    const endpoint = this.base_url + '/api/institution/update/' + id;
    return this.http.post<StatusResponse>(endpoint, body, { headers: this.authHeaders() });
  }

  // returns the list of all institutions (id, name, country, city)
  getInstitutions(): Observable<Institution[]> {
    const endpoint = this.base_url + '/api/institutions';
    return this.http.get<Institution[]>(endpoint, { headers: this.authHeaders() });
  }

  // returns the list of partner institutions linked to the given institution
  getInstitutionPartners(idInstitution: number): Observable<PartnerLink[]> {
    const endpoint = this.base_url + '/api/institution/' + idInstitution + '/partners';
    return this.http.get<PartnerLink[]>(endpoint, { headers: this.authHeaders() });
  }

  // returns the list of referents (users with role=referent) for the given institution
  getInstitutionReferents(id: number): Observable<User[]> {
    const endpoint = this.base_url + '/api/institution/' + id + '/referents';
    return this.http.get<User[]>(endpoint, { headers: this.authHeaders() });
  }

  // returns the list of students for the given institution
  getInstitutionStudents(id: number): Observable<User[]> {
    const endpoint = this.base_url + '/api/institution/' + id + '/students';
    return this.http.get<User[]>(endpoint, { headers: this.authHeaders() });
  }

  // returns the list of staff members for the given institution
  getInstitutionStaff(id: number): Observable<User[]> {
    const endpoint = this.base_url + '/api/institution/' + id + '/staff';
    return this.http.get<User[]>(endpoint, { headers: this.authHeaders() });
  }

  // returns the list of exams associated to the given institution
  getInstitutionExams(id: number): Observable<Exam[]> {
    const endpoint = this.base_url + '/api/institution/' + id + '/exams';
    return this.http.get<Exam[]>(endpoint, { headers: this.authHeaders() });
  }

  // returns the status of the new partner_institution mapping insertion
  insertPartnerInstitution(body: PartnerInsertBody): Observable<StatusResponse> {
    const endpoint = this.base_url + '/api/institution/partner/insert';
    return this.http.post<StatusResponse>(endpoint, body, { headers: this.authHeaders() });
  }

  // returns the status of the partner_institution mapping deletion
  deletePartnerInstitution(id: number): Observable<StatusResponse> {
    const endpoint = this.base_url + '/api/institution/partner/' + id + '/delete';
    return this.http.post<StatusResponse>(endpoint, {}, { headers: this.authHeaders() });
  }

  // returns the status of the partner_institution mapping update
  updatePartnerInstitution(id: number, body: PartnerUpdateBody): Observable<StatusResponse> {
    const endpoint = this.base_url + '/api/institution/partner/' + id + '/update';
    return this.http.post<StatusResponse>(endpoint, body, { headers: this.authHeaders() });
  }
}

export interface Institution {
  id: number;
  name: string;
  country: string;
  city: string;
}

export interface InstitutionInsertBody {
  name: string;
  country: string;
  city: string;
}

export interface InstitutionUpdateBody {
  name?: string;
  country?: string;
  city?: string;
}

export interface PartnerLink {
  partner_row_id: number;
  id_partner_institution: number;
  name: string;
  country: string;
  city: string;
}

export interface PartnerInsertBody {
  id_institution: number;
  id_partner_institution: number;
}

export interface PartnerUpdateBody {
  id_institution?: number;
  id_partner_institution?: number;
}
