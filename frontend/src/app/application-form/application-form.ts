import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { Cookies } from '../cookies';
import { User } from '../api/users';
import { Institutions, PartnerLink } from '../api/institutions';
import { Applications, ApplicationInsertBody, ApplicationUpdateBody } from '../api/applications';
import { Exams, Exam } from '../api/exams';

@Component({
  selector: 'app-application-form',
  imports: [CommonModule, FormsModule],
  templateUrl: './application-form.html',
  styleUrl: './application-form.css',
})
export class ApplicationForm {
  constructor(
    private cookie_manager: Cookies,
    private institutionsApi: Institutions,
    private applicationsApi: Applications,
    private examsApi: Exams,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  action: string = 'create';
  editApplicationId: number | null = null;

  user: User = {} as User;

  // form fields
  year: number = 0;
  semester: string = '';
  host_institution_id: number = 0;
  referent_id: number = 0;
  start_date: string = '';
  end_date: string = '';
  notes: string = '';

  // dropdown data
  semesters: string[] = [];
  academic_years: number[] = [];
  institutions: PartnerLink[] = [];
  referents: User[] = [];
  sendingExams: Exam[] = [];
  hostExams: Exam[] = [];

  examPairs: ExamPair[] = [{ local_exam_id: 0, host_exam_id: 0 }];
  selectedFile: File | null = null;

  isSubmitting = false;
  submitError = '';

  cancel() {
    this.router.navigate(['/applications']);
  }

  ngOnInit() {
    const userData = this.cookie_manager.getCookie('user');
    if (userData) {
      this.user = JSON.parse(userData);
    }

    const state = history.state;
    if (state?.mode === 'edit' && state?.application) {
      this.action = 'edit';
      const app = state.application;
      this.editApplicationId = app.id;
      this.year = app.year;
      this.semester = app.semester;
      this.host_institution_id = app.host_institution;
      this.referent_id = app.referent_id ?? 0;
      this.notes = app.notes ?? '';
      this.start_date = app.date_arrived ?? '';
      this.end_date = app.date_departure ?? '';
    }

    this.applicationsApi.getSemesters().subscribe({ next: res => this.semesters = res });
    this.applicationsApi.getAcademicYears().subscribe({ next: res => this.academic_years = res });
  }

  ngAfterViewInit() {
    const id = this.user?.id_institution;
    if (!id) return;

    this.institutionsApi.getInstitutionPartners(id).subscribe({
      next: res => this.institutions = res,
      error: err => console.error(err)
    });

    this.institutionsApi.getInstitutionReferents(id).subscribe({
      next: res => this.referents = res,
      error: err => console.error(err)
    });

    this.examsApi.listExamsByInstitution(id).subscribe({
      next: res => this.sendingExams = res,
      error: err => console.error(err)
    });

    if (this.action === 'edit' && this.host_institution_id > 0) {
      this.examsApi.listExamsByInstitution(this.host_institution_id).subscribe({
        next: res => this.hostExams = res,
        error: err => console.error(err)
      });
    }
  }

  onHostInstitutionChange() {
    this.hostExams = [];
    this.examPairs.forEach(p => p.host_exam_id = 0);
    if (this.host_institution_id > 0) {
      this.examsApi.listExamsByInstitution(this.host_institution_id).subscribe({
        next: res => this.hostExams = res,
        error: err => console.error(err)
      });
    }
  }

  addExamPair() {
    this.examPairs.push({ local_exam_id: 0, host_exam_id: 0 });
  }

  removeExamPair(index: number) {
    if (this.examPairs.length > 1) {
      this.examPairs.splice(index, 1);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile = input.files[0];
    }
  }

  removeFile() {
    this.selectedFile = null;
    const input = document.getElementById('la-upload') as HTMLInputElement;
    if (input) input.value = '';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  submitApplication() {
    if (!this.year || !this.semester || !this.host_institution_id) {
      this.submitError = 'Please fill in all required fields.';
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';

    if (this.action === 'edit' && this.editApplicationId !== null) {
      const body: ApplicationUpdateBody = {
        year: this.year,
        semester: this.semester,
        host_institution: this.host_institution_id,
        referent_id: this.referent_id || undefined,
        notes: this.notes || undefined,
        date_arrived: this.start_date || undefined,
        date_departure: this.end_date || undefined
      };
      this.applicationsApi.updateApplication(this.editApplicationId, body).subscribe({
        next: () => this.handleFileAndExams(this.editApplicationId!),
        error: err => {
          console.error(err);
          this.isSubmitting = false;
          this.submitError = 'Update failed. Please try again.';
        }
      });
    } else {
      const body: ApplicationInsertBody = {
        year: this.year,
        semester: this.semester,
        sending_institution: this.user.id_institution,
        host_institution: this.host_institution_id,
        referent_id: this.referent_id || undefined,
        notes: this.notes || undefined
      };
      this.applicationsApi.insertApplication(body).subscribe({
        next: res => {
          if (res.error) {
            this.isSubmitting = false;
            this.submitError = res.error;
            return;
          }
          const appId = res.id;
          if (!appId) {
            this.router.navigate(['/applications']);
            return;
          }
          if (this.start_date || this.end_date) {
            this.applicationsApi.updateApplication(appId, {
              date_arrived: this.start_date || undefined,
              date_departure: this.end_date || undefined
            }).subscribe({
              next: () => this.handleFileAndExams(appId),
              error: () => this.handleFileAndExams(appId)
            });
          } else {
            this.handleFileAndExams(appId);
          }
        },
        error: err => {
          console.error(err);
          this.isSubmitting = false;
          this.submitError = 'Submission failed. Please try again.';
        }
      });
    }
  }

  private handleFileAndExams(applicationId: number) {
    if (this.selectedFile) {
      this.applicationsApi.uploadApplicationDocument(applicationId, this.selectedFile).subscribe({
        next: res => {
          if (res.status === 'ok' && res.file_path) {
            this.applicationsApi.insertApplicationDocument({
              document_type: 'learning_agreement',
              file_path: res.file_path,
              application_id: applicationId
            }).subscribe({
              next: () => this.handleExamMappings(applicationId),
              error: () => this.handleExamMappings(applicationId)
            });
          } else {
            this.handleExamMappings(applicationId);
          }
        },
        error: () => this.handleExamMappings(applicationId)
      });
    } else {
      this.handleExamMappings(applicationId);
    }
  }

  private handleExamMappings(applicationId: number) {
    const validPairs = this.examPairs.filter(p => p.local_exam_id > 0 && p.host_exam_id > 0);
    if (!validPairs.length) {
      this.router.navigate(['/applications']);
      return;
    }
    let done = 0;
    const finish = () => { if (++done === validPairs.length) this.router.navigate(['/applications']); };
    validPairs.forEach(pair => {
      this.examsApi.insertMappedExam(applicationId, {
        sending_exam_id: pair.local_exam_id,
        host_exam_id: pair.host_exam_id
      }).subscribe({ next: finish, error: finish });
    });
  }
}

interface ExamPair {
  local_exam_id: number;
  host_exam_id: number;
}
