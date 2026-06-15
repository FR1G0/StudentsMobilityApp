import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Cookies } from '../cookies';
import { StatusResponse } from './users';

@Injectable({
  providedIn: 'root',
})
export class Applications {
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

  // returns the list of applications visible to the current user (filtered by role)
  getApplications(): Observable<Application[]> {
    const endpoint = this.base_url + '/api/applications';
    return this.http.get<Application[]>(endpoint, { headers: this.authHeaders() });
  }

  // returns the updated application after patching its fields
  patchApplication(applicationId: number, body: ApplicationPatchBody): Observable<Application> {
    const endpoint = this.base_url + '/api/applications/' + applicationId;
    return this.http.patch<Application>(endpoint, body, { headers: this.authHeaders() });
  }

  // returns the status of the insertion plus the id of the new application (student only)
  insertApplication(body: ApplicationInsertBody): Observable<StatusResponse> {
    const endpoint = this.base_url + '/api/application/insert';
    return this.http.post<StatusResponse>(endpoint, body, { headers: this.authHeaders() });
  }

  // returns the status of the update for the application of the given id
  updateApplication(id: number, body: ApplicationUpdateBody): Observable<StatusResponse> {
    const endpoint = this.base_url + '/api/application/update/' + id;
    return this.http.post<StatusResponse>(endpoint, body, { headers: this.authHeaders() });
  }

  // returns the status of the deletion (student/staff only)
  deleteApplication(id: number): Observable<StatusResponse> {
    const endpoint = this.base_url + '/api/application/delete/' + id;
    return this.http.post<StatusResponse>(endpoint, {}, { headers: this.authHeaders() });
  }

  // returns the list of allowed semester values
  getSemesters(): Observable<string[]> {
    const endpoint = this.base_url + '/api/application/info/semester';
    return this.http.get<string[]>(endpoint);
  }

  // returns the list of allowed application status values
  getStatuses(): Observable<string[]> {
    const endpoint = this.base_url + '/api/application/info/status';
    return this.http.get<string[]>(endpoint);
  }

  // returns the list of academic years starting from the current year for 5 years
  getAcademicYears(): Observable<number[]> {
    const endpoint = this.base_url + '/api/application/info/academic_years';
    return this.http.get<number[]>(endpoint);
  }

  // returns the list of documents associated to the application of the given id
  listApplicationDocuments(id: number): Observable<UploadedDocument[]> {
    const endpoint = this.base_url + '/api/application/documents/' + id;
    return this.http.post<UploadedDocument[]>(endpoint, {}, { headers: this.authHeaders() });
  }

  // returns the status of the document row insertion plus the new id
  insertApplicationDocument(body: DocumentInsertBody): Observable<StatusResponse> {
    const endpoint = this.base_url + '/api/application/document/insert';
    return this.http.post<StatusResponse>(endpoint, body, { headers: this.authHeaders() });
  }

  // returns the status of the file upload (multipart/form-data, field 'myfile')
  uploadApplicationDocument(applicationId: number, file: File): Observable<UploadResponse> {
    const endpoint = this.base_url + '/api/application/document/upload';
    const form = new FormData();
    form.append('application_id', String(applicationId));
    form.append('myfile', file);
    return this.http.post<UploadResponse>(endpoint, form, { headers: this.authHeaders() });
  }

  // returns the status of the document deletion (file + db row)
  deleteApplicationDocument(id: number): Observable<StatusResponse> {
    const endpoint = this.base_url + '/api/application/document/' + id + '/delete';
    return this.http.post<StatusResponse>(endpoint, {}, { headers: this.authHeaders() });
  }

  // returns the list of allowed document types
  getDocumentTypes(): Observable<string[]> {
    const endpoint = this.base_url + '/api/application/document/info/type';
    return this.http.get<string[]>(endpoint);
  }

  // returns the list of allowed document status values
  getDocumentStatuses(): Observable<string[]> {
    const endpoint = this.base_url + '/api/application/document/info/status';
    return this.http.get<string[]>(endpoint);
  }
}

export interface Application {
  id: number;
  year: number;
  semester: string;
  status: string;
  date_submitted: string | null;
  date_arrived: string | null;
  date_departure: string | null;
  notes: string;
  referent_id: number | null;
  sending_institution: number;
  host_institution: number;
  user_id: number;
}

export interface ApplicationInsertBody {
  year: number;
  semester: string;
  status?: string;
  notes?: string;
  referent_id?: number;
  sending_institution: number;
  host_institution: number;
}

export interface ApplicationUpdateBody {
  year?: number;
  semester?: string;
  status?: string;
  notes?: string;
  referent_id?: number;
  sending_institution?: number;
  host_institution?: number;
  date_arrived?: string | null;
  date_departure?: string | null;
}

export interface ApplicationPatchBody {
  year?: number;
  semester?: string;
  status?: string;
  date_submitted?: string;
  sending_institution?: number;
  host_institution?: number;
}

export interface UploadedDocument {
  id: number;
  document_type: string;
  file_path: string;
  date_updated: string | null;
  status: string;
  decision_date: string | null;
  notes: string;
  user_id: number;
  application_id: number;
}

export interface DocumentInsertBody {
  document_type: string;
  file_path: string;
  application_id: number;
  user_id?: number;
  notes?: string;
}

export interface UploadResponse {
  status: string;
  file_path?: string;
  error?: string;
}
