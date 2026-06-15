import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Cookies } from '../cookies';
import { StatusResponse } from './users';

@Injectable({
  providedIn: 'root',
})
export class Exams {
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

  // returns the list of exams that belong to the given institution
  listExamsByInstitution(idInstitution: number): Observable<Exam[]> {
    const endpoint = this.base_url + '/api/exam/list/' + idInstitution;
    return this.http.get<Exam[]>(endpoint, { headers: this.authHeaders() });
  }

  // returns the exam row with the given id
  getExam(id: number): Observable<Exam> {
    const endpoint = this.base_url + '/api/exam/' + id;
    return this.http.get<Exam>(endpoint, { headers: this.authHeaders() });
  }

  // returns the status of the exam insertion (staff only)
  insertExam(body: ExamInsertBody): Observable<StatusResponse> {
    const endpoint = this.base_url + '/api/exam/insert';
    return this.http.post<StatusResponse>(endpoint, body, { headers: this.authHeaders() });
  }

  // returns the status of the exam deletion (staff only)
  deleteExam(id: number): Observable<StatusResponse> {
    const endpoint = this.base_url + '/api/exam/delete/' + id;
    return this.http.post<StatusResponse>(endpoint, {}, { headers: this.authHeaders() });
  }

  // returns the status of the new mapped_exams row insertion for the given application
  insertMappedExam(applicationId: number, body: MappedExamInsertBody): Observable<StatusResponse> {
    const endpoint = this.base_url + '/api/exam/mapping/insert/' + applicationId;
    return this.http.post<StatusResponse>(endpoint, body, { headers: this.authHeaders() });
  }

  // returns the status of the mapped exam status update (sets decision_date to now)
  updateMappedExamStatus(id: number, body: MappedExamStatusBody): Observable<StatusResponse> {
    const endpoint = this.base_url + '/api/exam/mapping/update/' + id;
    return this.http.post<StatusResponse>(endpoint, body, { headers: this.authHeaders() });
  }

  // returns the status of the grade/date_passed update for the mapped exam
  setMappedExamPassed(id: number, body: MappedExamPassedBody): Observable<StatusResponse> {
    const endpoint = this.base_url + '/api/exam/mapping/passed/' + id;
    return this.http.post<StatusResponse>(endpoint, body, { headers: this.authHeaders() });
  }

  // returns the list of allowed status values for mapped exams
  getMappedExamStatuses(): Observable<string[]> {
    const endpoint = this.base_url + '/api/exam/mapped/info/status';
    return this.http.get<string[]>(endpoint);
  }
}

export interface Exam {
  id: number;
  code: string;
  name: string;
  credits: number;
  id_institution: number;
}

export interface ExamInsertBody {
  code: string;
  name: string;
  credits: number;
  id_institution: number;
}

export interface MappedExamInsertBody {
  host_exam_id: number;
  sending_exam_id: number;
  notes?: string;
  previous_id?: number;
}

export interface MappedExamStatusBody {
  status?: string;
  notes?: string;
}

export interface MappedExamPassedBody {
  grade?: number;
  date_passed?: string | null;
}
