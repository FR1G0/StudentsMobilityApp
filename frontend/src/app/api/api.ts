import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Cookies } from '../cookies';

@Injectable({
  providedIn: 'root',
})
export class Api {
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

  // returns the health check info (db name, db version, table counts)
  getHealth(): Observable<HealthResponse> {
    const endpoint = this.base_url + '/api/health';
    return this.http.get<HealthResponse>(endpoint);
  }

  // returns the summary info (counts, recent applications, top institutions)
  getSummary(): Observable<SummaryResponse> {
    const endpoint = this.base_url + '/api/summary';
    return this.http.get<SummaryResponse>(endpoint, { headers: this.authHeaders() });
  }

  // returns the list of institutions with partner counts
  getInstitutions(): Observable<InstitutionWithPartnerCount[]> {
    const endpoint = this.base_url + '/api/institutions';
    return this.http.get<InstitutionWithPartnerCount[]>(endpoint, { headers: this.authHeaders() });
  }

  // returns the list of exams joined with their institution
  getExams(): Observable<ExamWithInstitution[]> {
    const endpoint = this.base_url + '/api/exams';
    return this.http.get<ExamWithInstitution[]>(endpoint, { headers: this.authHeaders() });
  }
}

export interface TableCounts {
  users: number;
  institutions: number;
  applications: number;
  exams: number;
}

export interface HealthResponse {
  status: string;
  database_name: string;
  database_version: string;
  counts: TableCounts;
}

export interface RecentApplication {
  id: number;
  year: number;
  semester: string;
  status: string;
  date_submitted: string | null;
  sending_institution: number;
  host_institution: number;
  user_id: number;
  student_name: string;
  sending_institution_name: string;
  host_institution_name: string;
}

export interface InstitutionWithPartnerCount {
  id: number;
  name: string;
  country: string;
  city: string;
  partner_count: number;
}

export interface SummaryResponse {
  counts: TableCounts;
  recent_applications: RecentApplication[];
  top_institutions: InstitutionWithPartnerCount[];
}

export interface ExamWithInstitution {
  code: string;
  name: string;
  credits: number;
  id_institution: number;
  institution_name: string;
  institution_country: string;
}
