import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Cookies } from '../cookies';
import { StatusResponse } from './users';
import { MappedExamRow } from './exams';

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

  // returns the list of applications visible to the current user (filtered by role),
  // each joined with its sending/host institutions, owner student and referent
  getApplicationsInfo(): Observable<ApplicationInfo[]> {
    const endpoint = this.base_url + '/api/applications/info/list';
    return this.http.get<ApplicationInfo[]>(endpoint, { headers: this.authHeaders() });
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

  // returns the status of the workflow status change for the application of the given id
  updateApplicationStatus(id: number, body: ApplicationStatusBody): Observable<StatusResponse> {
    const endpoint = this.base_url + '/api/application/status/update/' + id;
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

  // returns the raw file blob for the given document id (used to download it)
  downloadDocument(id: number): Observable<Blob> {
    const endpoint = this.base_url + '/api/application/document/' + id + '/download';
    return this.http.get(endpoint, { headers: this.authHeaders(), responseType: 'blob' });
  }

  // returns the status of the document deletion (file + db row)
  deleteApplicationDocument(id: number): Observable<StatusResponse> {
    const endpoint = this.base_url + '/api/application/document/' + id + '/delete';
    return this.http.post<StatusResponse>(endpoint, {}, { headers: this.authHeaders() });
  }

  // returns the status of the referent decision on a document (approve/reject a
  // learning agreement or transcript); a rejection requires a motivation in "notes"
  decideDocument(id: number, body: DocumentDecisionBody): Observable<StatusResponse> {
    const endpoint = this.base_url + '/api/application/document/' + id + '/decision';
    return this.http.post<StatusResponse>(endpoint, body, { headers: this.authHeaders() });
  }

  // returns the list of mapped_exams rows associated to the given application
  listApplicationExamMappings(applicationId: number): Observable<MappedExamRow[]> {
    const endpoint = this.base_url + '/api/application/exams_mapping/' + applicationId;
    return this.http.get<MappedExamRow[]>(endpoint, { headers: this.authHeaders() });
  }

  // returns the status of the LA modification proposal creation plus the new id (student only);
  // the current exam mapping is snapshotted and replaced by the proposed one
  createModification(applicationId: number, body: ModificationCreateBody): Observable<StatusResponse> {
    const endpoint = this.base_url + '/api/application/' + applicationId + '/modification';
    return this.http.post<StatusResponse>(endpoint, body, { headers: this.authHeaders() });
  }

  // returns the list of LA modification proposals of the given application, each with its snapshot
  listModifications(applicationId: number): Observable<LAModification[]> {
    const endpoint = this.base_url + '/api/application/' + applicationId + '/modifications';
    return this.http.get<LAModification[]>(endpoint, { headers: this.authHeaders() });
  }

  // returns the status of the referent decision on a modification (approve/reject);
  // a rejection requires a motivation in "notes" and restores the previous mapping
  decideModification(id: number, body: ModificationDecisionBody): Observable<StatusResponse> {
    const endpoint = this.base_url + '/api/modification/' + id + '/decision';
    return this.http.post<StatusResponse>(endpoint, body, { headers: this.authHeaders() });
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

// nested institution info attached to a joined application
export interface ApplicationInstitutionInfo {
  id: number;
  name: string;
}

// nested user info (owner student / referent) attached to a joined application
export interface ApplicationUserInfo {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
}

// an application joined with its sending/host institutions, owner and referent
export interface ApplicationInfo extends Application {
  sending: ApplicationInstitutionInfo | null;
  host: ApplicationInstitutionInfo | null;
  user: ApplicationUserInfo | null;
  referent: ApplicationUserInfo | null;
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
  notes?: string;
  referent_id?: number;
  sending_institution?: number;
  host_institution?: number;
  date_arrived?: string | null;
  date_departure?: string | null;
}

// body for the dedicated status route: only moves the workflow status
export interface ApplicationStatusBody {
  status: string;
  notes?: string;
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

export interface DocumentDecisionBody {
  status: string;
  notes?: string;
}

export interface UploadResponse {
  status: string;
  file_path?: string;
  error?: string;
}

// one proposed exam mapping row inside a modification proposal
export interface ModificationMappingItem {
  host_exam_id: number;
  sending_exam_id: number;
  notes?: string;
}

// body for the modification proposal creation: description + updated LA + new mapping
export interface ModificationCreateBody {
  description: string;
  document_id: number;
  mapping: ModificationMappingItem[];
}

// body for the referent decision on a modification (approve/reject)
export interface ModificationDecisionBody {
  status: string;
  notes?: string;
}

// snapshot row of the exam mapping as it was BEFORE the modification
export interface LAModificationExam {
  id: number;
  modification_id: number;
  host_exam_id: number;
  sending_exam_id: number;
  grade: number;
  date_passed: string | null;
  status: string;
  notes: string;
  decision_date: string | null;
}

export interface LAModification {
  id: number;
  application_id: number;
  description: string;
  status: string;
  decision_date: string | null;
  notes: string;
  document_id: number | null;
  snapshot: LAModificationExam[];
}
