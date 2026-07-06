import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { App } from '../app';
import { Exams, Exam, ExamInsertBody } from '../api/exams';

@Component({
  selector: 'app-manage-exams',
  imports: [FormsModule],
  templateUrl: './manage-exams.html',
  styleUrl: './manage-exams.css',
})
export class ManageExams implements OnInit {
  constructor(
    private examsApi: Exams,
    private app: App,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  isLoading = true;

  // new exam form fields
  newCode = '';
  newName = '';
  newCredits = 0;

  exams: Exam[] = [];

  // institution of the logged staff member: created exams must belong to it
  get institutionId(): number {
    return this.app.user_data.id_institution;
  }

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) { return; }
    this.loadExams();
  }

  loadExams() {
    this.examsApi.listExamsByInstitution(this.institutionId).subscribe({
      next: res => {
        this.exams = res;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.notifyError(err, 'could not load exams');
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // creates the new exam described by the form (same institution as the staff)
  createExam() {
    if (!this.newCode || !this.newName || this.newCredits <= 0) {
      this.app.send_notification('all fields are required', 'warning');
      return;
    }

    const body: ExamInsertBody = {
      code: this.newCode,
      name: this.newName,
      credits: this.newCredits,
      id_institution: this.institutionId,
    };

    this.examsApi.insertExam(body).subscribe({
      next: res => {
        if (res.status === 'success') {
          this.app.send_notification('Exam ' + body.code + ' created', 'success');
          this.newCode = '';
          this.newName = '';
          this.newCredits = 0;
          this.loadExams();
        } else {
          this.app.send_notification(res.error || 'insert error', 'error');
        }
      },
      error: err => this.notifyError(err, 'insert error'),
      complete: () => this.cdr.markForCheck()
    });
  }

  deleteExam(exam: Exam) {
    if (!isPlatformBrowser(this.platformId)) { return; }
    const confirmed = window.confirm('Delete exam ' + exam.code + ' (' + exam.name + ')? This cannot be undone.');
    if (!confirmed) { return; }

    this.examsApi.deleteExam(exam.id).subscribe({
      next: res => {
        if (res.status === 'success') {
          this.exams = this.exams.filter(e => e.id !== exam.id);
          this.app.send_notification('Exam ' + exam.code + ' deleted', 'success');
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
