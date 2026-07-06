import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

// Maps to backend/routes/api.py and applications.py.
// Ensure 'Authorization' header is attached via an Interceptor or Manual pipe.
const API_BASE_URL = 'http://localhost:5000/api';

export interface DashboardCounts {
  users: number;
  institutions: number;
  applications: number;
  exams: number;
}

export interface DashboardApplication {
  id: number;
  year: number;
  semester: string;
  status: string;
  date_submitted: string | null;
  sending_institution: number;
  host_institution: number;
  user_id: number;
  student_name: string;
  student_email: string;
  sending_institution_name: string;
  host_institution_name: string;
}

export interface DashboardInstitution {
  id: number;
  name: string;
  country: string;
  city: string;
  partner_count: number;
}

export interface DashboardSummary {
  counts: DashboardCounts;
  recent_applications: DashboardApplication[];
  top_institutions: DashboardInstitution[];
}

export interface HealthResponse {
  status: string;
  database_name: string;
  database_version: string;
  counts: DashboardCounts;
}

export interface ExamRow {
  code: string;
  name: string;
  credits: number;
  id_institution: number;
  institution_name: string;
  institution_country: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  getHealth(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${API_BASE_URL}/health`);
  }

  getSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${API_BASE_URL}/summary`);
  }

  getApplications(status?: string): Observable<DashboardApplication[]> {
    const url = status
      ? `${API_BASE_URL}/applications?status=${encodeURIComponent(status)}`
      : `${API_BASE_URL}/applications`;
    return this.http.get<DashboardApplication[]>(url);
  }

  getExams(): Observable<ExamRow[]> {
    return this.http.get<ExamRow[]>(`${API_BASE_URL}/exams`);
  }
}
