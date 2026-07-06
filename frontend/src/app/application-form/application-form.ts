import { Component, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { App } from '../app';
import { Cookies } from '../cookies';
import { User, Users } from '../api/users';
import { Institutions, PartnerLink } from '../api/institutions';
import { Applications, ApplicationInsertBody, ApplicationUpdateBody, ApplicationStatusBody, UploadedDocument, LAModification, ModificationMappingItem } from '../api/applications';
import { Exams, Exam, MappedExamRow } from '../api/exams';

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
    private usersApi: Users,
    private app: App,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  // returns the error message sent back by the backend, or the given fallback
  private backendError(err: any, fallback: string): string {
    if (err && err.error && err.error.error) {
      return err.error.error;
    }
    return fallback;
  }

  // notifies the user the save went well and goes back to the applications list
  private goToApplications() {
    let message = 'Application created';
    if (this.action === 'edit') {
      message = 'Application updated';
    }
    this.app.send_notification(message, 'success');
    this.router.navigate(['/applications']);
  }

  action: string = 'create';
  editApplicationId: number = 0;
  editUserId: number = 0;

  user: User = {} as User;

  // form fields
  year: number = 0;
  semester: string = '';
  host_institution_id: number = 0;
  referent_id: number = 0;
  start_date: string = '';
  end_date: string = '';
  notes: string = '';
  status: string = '';

  // dropdown data
  semesters: string[] = [];
  academic_years: number[] = [];
  institutions: PartnerLink[] = [];
  referents: User[] = [];
  sendingExams: Exam[] = [];
  hostExams: Exam[] = [];

  examPairs: ExamPair[] = [{ local_exam_id: 0,  host_exam_id: 0 }];
  // immutable snapshot of the mappings as loaded from the backend, used to diff
  // against the edited examPairs on save (examPairs get mutated in place by ngModel)
  loadedMappings: LoadedMapping[] = [];
  selectedFile: File | null = null;
  existingDocument: UploadedDocument | null = null;
  existingTranscript: UploadedDocument | null = null;
  transcriptFile: File | null = null;

  // learning agreement modification proposals (status: mobility_ongoing)
  modifications: LAModification[] = [];
  modificationDescription: string = '';

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

    if(isPlatformBrowser(this.platformId)) {
      const state = history.state;
      if (state?.mode === 'edit' && state?.application) {
        this.action = 'edit';
        const app = state.application;
        this.editApplicationId = app.id;
        this.editUserId = app.user_id;
        this.year = app.year;
        this.semester = app.semester;
        this.host_institution_id = app.host_institution;
        this.referent_id = app.referent_id ?? 0;
        this.notes = app.notes ?? '';
        this.status = app.status ?? '';
        this.start_date = app.date_arrived ?? '';
        this.end_date = app.date_departure ?? '';
      }
      this.cdr.markForCheck();
    }


    this.applicationsApi.getSemesters().subscribe({
      next: res => this.semesters = res,
      complete : () => { this.cdr.markForCheck(); }
    });
    this.applicationsApi.getAcademicYears().subscribe({
      next: res => this.academic_years = res,
      complete : () => { this.cdr.markForCheck(); }
    });
  }

  ngAfterViewInit() {
    const id = this.user?.id_institution;
    if (!id) return;

    this.institutionsApi.getInstitutionPartners(id).subscribe({
      next: res => this.institutions = res,
      error: err => console.error(err),
      complete : () => { this.cdr.markForCheck(); }
    });

    this.institutionsApi.getInstitutionReferents(id).subscribe({
      next: res => this.referents = res,
      error: err => console.error(err),
      complete : () => { this.cdr.markForCheck(); }
    });

    this.examsApi.listExamsByInstitution(id).subscribe({
      next: res => this.sendingExams = res,
      error: err => console.error(err),
      complete : () => { this.cdr.markForCheck(); }
    });

    if (this.action === 'edit' && this.host_institution_id > 0) {
      // update user data
      this.usersApi.getUser(this.editUserId).subscribe({
        next: res => this.user = res,
        error: err => console.error(err),
      complete : () => { this.cdr.markForCheck(); }
      })

      // get exam mappings
      this.loadExamMappings();

      // the modification proposals are loaded first: when one is pending, its
      // document is the learning agreement to display (see loadDocuments)
      this.loadModifications(() => this.loadDocuments());
    }
  }

  // loads (or reloads) the exam mappings of the application into examPairs. the
  // status/grade carried by each row is used to drive the exam_recognition inputs,
  // so this must be re-run after a status transition that resets them server-side.
  private loadExamMappings(then?: () => void) {
    this.applicationsApi.listApplicationExamMappings(this.editApplicationId).subscribe({
      next: res => {
        this.onHostInstitutionChange();
        this.examPairs = [];
        this.loadedMappings = [];
        for(let exam_map of res) {
          this.examPairs.push({
            local_exam_id: exam_map.sending_exam_id,
            host_exam_id: exam_map.host_exam_id,
            mapping_id: exam_map.id,
            status: exam_map.status,
            notes: exam_map.notes,
            grade: exam_map.grade > 0 ? exam_map.grade : null,
            date_passed: exam_map.date_passed || ''
          });
          this.loadedMappings.push({
            id: exam_map.id,
            sending_exam_id: exam_map.sending_exam_id,
            host_exam_id: exam_map.host_exam_id
          });
        }
        // keep at least one empty row so the user can still edit
        if (this.examPairs.length === 0) {
          this.examPairs.push({ local_exam_id: 0, host_exam_id: 0 });
        }
      },
      error: err => {
        console.error(err)
      },
      complete : () => { this.cdr.markForCheck(); if (then) then(); }
    });
  }

  // a mapped exam is locked in the exam_recognition phase only once its grade has
  // actually been recognized: an 'approved' status carrying a recorded grade. an
  // approved-but-ungraded mapping (approved during the learning agreement phase and
  // reset to 'pending' on entering exam_recognition) still needs a grade, so it
  // stays editable.
  examResultLocked(pair: ExamPair): boolean {
    return pair.status === 'approved' && pair.grade != null;
  }

  onHostInstitutionChange() {
    this.hostExams = [];
    this.examPairs.forEach(p => p.host_exam_id = 0);
    if (this.host_institution_id > 0) {
      this.examsApi.listExamsByInstitution(this.host_institution_id).subscribe({
        next: res => this.hostExams = res,
        error: err => console.error(err),
        complete : () => { this.cdr.markForCheck(); }
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

  // downloads the given uploaded document by fetching its blob and saving it
  downloadDocument(doc: UploadedDocument) {
    this.applicationsApi.downloadDocument(doc.id).subscribe({
      next: blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = doc.file_path.split('/').pop() || 'document';
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: err => console.error(err)
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  submitApplication() {
    // during the mobility the submit button has dedicated behaviours:
    // mobility_ongoing  -> save the arrival date and propose an LA modification
    // exam_recognition  -> save the departure date and the exam results
    if (this.action === 'edit' && this.status === 'mobility_ongoing') {
      this.submitMobilityChanges();
      return;
    }
    if (this.action === 'edit' && this.status === 'exam_recognition') {
      this.submitRecognitionResults();
      return;
    }

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
          this.submitError = this.backendError(err, 'Update failed. Please try again.');
          this.app.send_notification(this.submitError, 'error');
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
            this.app.send_notification(res.error, 'error');
            return;
          }
          const appId = res.id;
          if (!appId) {
            this.goToApplications();
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
          this.submitError = this.backendError(err, 'Submission failed. Please try again.');
          this.app.send_notification(this.submitError, 'error');
        }
      });
    }
  }

  private handleFileAndExams(applicationId: number) {
    if (!this.selectedFile) {
      this.handleExamMappings(applicationId);
      return;
    }

    // when replacing, remove the previous learning agreement row first
    if (this.existingDocument) {
      this.applicationsApi.deleteApplicationDocument(this.existingDocument.id).subscribe({
        next: () => console.log("uploaded"),
        error: err => console.error(err),
        complete : () => this.uploadAndInsert(applicationId)
      });
    } else {
      this.uploadAndInsert(applicationId);
    }
  }

  private uploadAndInsert(applicationId: number) {
      this.applicationsApi.uploadApplicationDocument(applicationId, this.selectedFile!).subscribe({
        next: res => {
          if (res.status === 'success' && res.file_path) {
            this.applicationsApi.insertApplicationDocument({
              document_type: 'learning_agreement',
              file_path: res.file_path,
              application_id: applicationId
            }).subscribe({
              next: () => this.handleExamMappings(applicationId),
              error: err => {
                console.log(err);
                this.app.send_notification(this.backendError(err, 'Could not save the learning agreement'), 'warning');
                this.handleExamMappings(applicationId);
              }
            });
          } else {
            console.log(res);
            this.handleExamMappings(applicationId);
          }
        },
        error: err => {
          this.app.send_notification(this.backendError(err, 'Could not upload the learning agreement'), 'warning');
          this.handleExamMappings(applicationId);
        }
      });
    }


  private handleExamMappings(applicationId: number) {
    const pairKey = (sending: number, host: number) => sending + '->' + host;
    const validPairs = this.examPairs.filter(p => p.local_exam_id > 0 && p.host_exam_id > 0);

    // diff the edited pairs against the snapshot loaded from the backend
    const loadedKeys = new Set(this.loadedMappings.map(m => pairKey(m.sending_exam_id, m.host_exam_id)));
    const currentKeys = new Set(validPairs.map(p => pairKey(p.local_exam_id, p.host_exam_id)));

    // only touch what actually changed: delete the loaded mappings that are gone,
    // insert the pairs that are new; identical pairs are left untouched. a changed
    // pair (same exam, different target) appears in both lists, so it is handled.
    const toDelete = this.loadedMappings.filter(m => !currentKeys.has(pairKey(m.sending_exam_id, m.host_exam_id)));
    const toInsert = validPairs.filter(p => !loadedKeys.has(pairKey(p.local_exam_id, p.host_exam_id)));

    // nothing changed in the exam mapping: skip the delete/insert round-trip
    if (toDelete.length === 0 && toInsert.length === 0) {
      this.goToApplications();
      return;
    }

    if (toDelete.length === 0) {
      this.insertMappings(applicationId, toInsert);
      return;
    }

    // delete removed/changed mappings first so the re-inserts do not collide with
    // the unique constraints, then insert the new ones
    let deleted = 0;
    const afterDelete = () => {
      deleted = deleted + 1;
      if (deleted === toDelete.length) {
        this.insertMappings(applicationId, toInsert);
      }
    };
    for (let mapping of toDelete) {
      this.examsApi.deleteMappedExam(mapping.id).subscribe({ next: afterDelete, error: afterDelete });
    }
  }

  private insertMappings(applicationId: number, validPairs: ExamPair[]) {
    if (!validPairs.length) {
      this.goToApplications();
      return;
    }
    let done = 0;
    const finish = () => { if (++done === validPairs.length) this.goToApplications(); };
    for (let pair of validPairs) {
      this.examsApi.insertMappedExam(applicationId, {
        sending_exam_id: pair.local_exam_id,
        host_exam_id: pair.host_exam_id
      }).subscribe({
        next: finish,
        error: err => {
          this.app.send_notification(this.backendError(err, 'An exam mapping could not be saved'), 'warning');
          finish();
        }
      });
    }
  }

  shortenStatus(status: string): string {
    if (status == 'learning_agreement_pending') return 'la pending';
    if (status == 'pre_departure_completed') return 'pre completed';
    if (status == 'mobility_ongoing') return 'ongoing';
    if (status == 'exam_recognition') return 'exam recognition';
    return status;
  }

  // ---- Student mobility lifecycle ----
  // start mobility moves the application to 'mobility_ongoing' and registers the
  // arrival date. end mobility moves it to 'exam_recognition'. the database
  // triggers validate each transition.

  startMobility() {
    // the backend rejects any data update while in 'pre_departure_completed', so
    // this transition only moves the status: the mobility dates were already
    // stored during the earlier phases
    this.changeStatus('mobility_ongoing', 'Mobility started');
  }

  endMobility() {
    // first save the mobility dates (still allowed while 'mobility_ongoing'),
    // then move the status through the dedicated status route
    this.applicationsApi.updateApplication(this.editApplicationId, {
      date_arrived: this.start_date || undefined,
      date_departure: this.end_date || undefined
    }).subscribe({
      // entering exam_recognition resets every mapped exam to 'pending' server-side
      // (a grade is now expected): reload the mappings so the grade inputs unlock
      next: () => this.changeStatus('exam_recognition', 'Mobility ended', () => this.loadExamMappings()),
      error: err => this.app.send_notification(this.backendError(err, 'Operation failed'), 'error')
    });
  }

  private changeStatus(newStatus: string, message: string, then?: () => void) {
    // carry the student's notes along with every status transition: they are
    // editable in the phases listed by notesEditable() and must be persisted
    const body: ApplicationStatusBody = { status: newStatus };
    if (this.notes && this.notes.trim()) {
      body.notes = this.notes;
    }
    this.applicationsApi.updateApplicationStatus(this.editApplicationId, body).subscribe({
      next: res => {
        if (res.status !== 'success') {
          this.app.send_notification(res.error || 'Operation failed', 'error');
          return;
        }
        this.status = newStatus;
        this.app.send_notification(message, 'success');
        if (then) then();
      },
      error: err => this.app.send_notification(this.backendError(err, 'Operation failed'), 'error'),
      complete: () => this.cdr.markForCheck()
    });
  }

  // ---- Learning Agreement modifications (status: mobility_ongoing) ----
  // the submit button saves the mobility dates and, when a description is
  // given, proposes an LA modification: the backend snapshots the current
  // mapping and replaces it with the proposed one in a single transaction.

  private submitMobilityChanges() {
    const description = this.modificationDescription.trim();
    if (!description && !this.start_date && !this.end_date) {
      this.app.send_notification('Set a mobility date or describe a modification', 'warning');
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';

    if (!this.start_date && !this.end_date) {
      this.proposeModification(description);
      return;
    }
    this.applicationsApi.updateApplication(this.editApplicationId, {
      date_arrived: this.start_date || undefined,
      date_departure: this.end_date || undefined
    }).subscribe({
      next: () => {
        if (!description) {
          this.finishSubmit('Mobility dates saved');
          return;
        }
        this.proposeModification(description);
      },
      error: err => this.failSubmit(err, 'Could not save the mobility dates')
    });
  }

  private proposeModification(description: string) {
    // the backend requires the learning agreement document of the application:
    // either the existing one or a replacement the student just selected
    if (!this.existingDocument && !this.selectedFile) {
      this.failSubmit(null, 'A learning agreement must be uploaded before proposing a modification');
      return;
    }

    // the whole exam mapping must be snapshotted: the backend deletes every live
    // mapping and re-inserts only what is sent here, so the proposed mapping has
    // to carry ALL the exam pairs, not only the modified ones. an empty row (both
    // dropdowns untouched) is just a placeholder and is skipped, but a half-filled
    // row is refused so a mapped exam cannot be silently dropped.
    const mapping: ModificationMappingItem[] = [];
    for (let pair of this.examPairs) {
      const hasLocal = pair.local_exam_id > 0;
      const hasHost = pair.host_exam_id > 0;
      if (!hasLocal && !hasHost) {
        continue;
      }
      if (!hasLocal || !hasHost) {
        this.failSubmit(null, 'Every exam pair must have both a local and a host exam');
        return;
      }
      mapping.push({ sending_exam_id: pair.local_exam_id, host_exam_id: pair.host_exam_id });
    }
    if (mapping.length === 0) {
      this.failSubmit(null, 'The proposed mapping needs at least one exam pair');
      return;
    }

    // if the student replaced the learning agreement, upload the new file first
    // and attach the freshly created document to the modification
    this.ensureLearningAgreement(documentId => {
      this.applicationsApi.createModification(this.editApplicationId, {
        description: description,
        document_id: documentId,
        mapping: mapping
      }).subscribe({
        next: () => this.finishSubmit('Modification proposed'),
        error: err => this.failSubmit(err, 'Could not propose the modification')
      });
    });
  }

  // makes sure the modification points at the right learning agreement: when the
  // student picked a new file it is uploaded and inserted as an ADDITIONAL
  // document and its new id is yielded, otherwise the existing document id is
  // yielded. the previous learning agreement is deliberately kept: rejecting the
  // modification deletes the proposed document (backend), which rolls the
  // application back to the previous learning agreement.
  private ensureLearningAgreement(next: (documentId: number) => void) {
    if (!this.selectedFile) {
      next(this.existingDocument!.id);
      return;
    }

    const uploadAndInsert = () => {
      this.applicationsApi.uploadApplicationDocument(this.editApplicationId, this.selectedFile!).subscribe({
        next: res => {
          if (res.status !== 'success' || !res.file_path) {
            this.failSubmit(null, 'Could not upload the new learning agreement');
            return;
          }
          this.applicationsApi.insertApplicationDocument({
            document_type: 'learning_agreement',
            file_path: res.file_path,
            application_id: this.editApplicationId
          }).subscribe({
            next: insertRes => {
              if (!insertRes.id) {
                this.failSubmit(null, 'Could not save the new learning agreement');
                return;
              }
              // refresh local state so the new document is the current one (a retry
              // after a later failure must not delete/re-upload it again)
              this.existingDocument = {
                ...(this.existingDocument as UploadedDocument),
                id: insertRes.id,
                file_path: res.file_path!,
                status: 'pending',
                notes: ''
              };
              this.selectedFile = null;
              next(insertRes.id);
            },
            error: err => this.failSubmit(err, 'Could not save the new learning agreement')
          });
        },
        error: err => this.failSubmit(err, 'Could not upload the new learning agreement')
      });
    };

    uploadAndInsert();
  }

  // ---- Exam results (status: exam_recognition) ----
  // the submit button registers the grade and passing date of each mapped exam
  // through the dedicated backend route. the mobility dates are already locked in
  // this phase, so no application update is made here.

  private submitRecognitionResults() {
    const results = this.gradedPairs();
    if (results.length === 0) {
      this.app.send_notification('Fill in an exam result', 'warning');
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';

    this.submitExamResults(results);
  }

  // exam pairs carrying a grade and a date to register (approved ones are locked)
  private gradedPairs(): ExamPair[] {
    const results: ExamPair[] = [];
    for (let pair of this.examPairs) {
      if (pair.mapping_id && !this.examResultLocked(pair) && pair.grade && pair.date_passed) {
        results.push(pair);
      }
    }
    return results;
  }

  private submitExamResults(results: ExamPair[]) {
    let done = 0;
    const finish = () => {
      if (++done === results.length) this.finishSubmit('Exam results saved');
    };
    for (let pair of results) {
      this.examsApi.setMappedExamPassed(pair.mapping_id!, {
        grade: pair.grade!,
        date_passed: pair.date_passed!
      }).subscribe({
        next: finish,
        error: err => {
          this.app.send_notification(this.backendError(err, 'Could not save an exam result'), 'warning');
          finish();
        }
      });
    }
  }

  // loads the LA modification proposals of the application (the backend returns
  // only the pending ones), then lets the caller continue: the documents load
  // depends on this list to pick the learning agreement to display
  private loadModifications(then?: () => void) {
    this.applicationsApi.listModifications(this.editApplicationId).subscribe({
      next: res => this.modifications = res,
      error: err => {
        console.error(err);
        if (then) then();
      },
      complete: () => {
        this.cdr.markForCheck();
        if (then) then();
      }
    });
  }

  // loads the uploaded documents of the application. the learning agreement to
  // display is the one proposed by the pending modification (its document_id)
  // when there is one; otherwise it falls back to the latest learning agreement
  // of the application. the fallback is what implements the rollback: rejecting
  // a modification deletes its document, so the previous LA is what remains.
  private loadDocuments() {
    this.applicationsApi.listApplicationDocuments(this.editApplicationId).subscribe({
      next: res => {
        const las = res.filter(d => d.document_type === 'learning_agreement');
        const pending = this.modifications.find(m => m.status === 'pending' && m.document_id != null);
        const pendingLa = pending ? las.find(d => d.id === pending.document_id) : undefined;
        this.existingDocument = pendingLa ?? las[las.length - 1] ?? null;
        const tor = res.find(d => d.document_type === 'transcript');
        if (tor) this.existingTranscript = tor;
      },
      error: err => console.error(err),
      complete: () => { this.cdr.markForCheck(); }
    });
  }

  // ends a submit with a success notification and goes back to the list
  private finishSubmit(message: string) {
    this.isSubmitting = false;
    this.app.send_notification(message, 'success');
    this.router.navigate(['/applications']);
  }

  // ends a submit surfacing the backend error to the user
  private failSubmit(err: any, fallback: string) {
    if (err) console.error(err);
    this.isSubmitting = false;
    this.submitError = this.backendError(err, fallback);
    this.app.send_notification(this.submitError, 'error');
    this.cdr.markForCheck();
  }

  // the student may add/edit notes while creating the application, and while it
  // sits in a phase that still accepts edits. on create and in
  // 'created'/'learning_agreement_pending' the notes are saved through the
  // regular insert/update; in 'mobility_ongoing'/'exam_recognition' they ride
  // along with the status transition (see changeStatus).
  notesEditable(): boolean {
    if (this.action === 'create') {
      return true;
    }
    return this.action === 'edit' && this.user.role === 'student' &&
      (this.status === 'created' || this.status === 'learning_agreement_pending' ||
        this.status === 'mobility_ongoing' || this.status === 'exam_recognition');
  }

  // core application fields are locked once the pre-departure checks are done
  coreFieldsLocked(): boolean {
    return this.action === 'edit' &&
      (this.status === 'pre_departure_completed' || this.status === 'mobility_ongoing' ||
        this.status === 'exam_recognition' || this.status === 'closed');
  }

  // the exam pairs stay editable during the mobility (to propose modifications)
  examPairsLocked(): boolean {
    return this.action === 'edit' &&
      (this.status === 'pre_departure_completed' || this.status === 'exam_recognition' ||
        this.status === 'closed');
  }

  // both dates stay editable only while 'mobility_ongoing'. they are locked in
  // 'pre_departure_completed', 'exam_recognition' and 'closed'.
  startDateLocked(): boolean {
    return this.action === 'edit' &&
      (this.status === 'pre_departure_completed' || this.status === 'exam_recognition' ||
        this.status === 'closed');
  }

  endDateLocked(): boolean {
    return this.action === 'edit' &&
      (this.status === 'pre_departure_completed' || this.status === 'exam_recognition' ||
        this.status === 'closed');
  }

  // no document can be uploaded or replaced while the application sits in
  // 'pre_departure_completed' or after closure; during 'mobility_ongoing' the
  // learning agreement stays replaceable to propose modifications
  learningAgreementLocked(): boolean {
    return this.coreFieldsLocked() && this.status !== 'mobility_ongoing';
  }

  // text of the single submit button, based on the workflow phase
  submitLabel(): string {
    if (this.action !== 'edit') return 'Submit Application';
    if (this.status === 'mobility_ongoing') return 'Submit Modification';
    if (this.status === 'exam_recognition') return 'Submit Results';
    return 'Save Changes';
  }

  onTranscriptSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.transcriptFile = input.files[0];
    }
  }

  // uploads the transcript of records during 'exam_recognition'
  uploadTranscript() {
    if (!this.transcriptFile) {
      this.app.send_notification('Please select a transcript file', 'warning');
      return;
    }
    this.applicationsApi.uploadApplicationDocument(this.editApplicationId, this.transcriptFile).subscribe({
      next: res => {
        if (res.status === 'success' && res.file_path) {
          this.applicationsApi.insertApplicationDocument({
            document_type: 'transcript',
            file_path: res.file_path,
            application_id: this.editApplicationId
          }).subscribe({
            next: () => {
              this.transcriptFile = null;
              this.app.send_notification('Transcript uploaded', 'success');
              this.reloadTranscript();
            },
            error: err => this.app.send_notification(this.backendError(err, 'Could not save the transcript'), 'error'),
            complete: () => this.cdr.markForCheck()
          });
        } else {
          this.app.send_notification('Could not upload the transcript', 'error');
        }
      },
      error: err => this.app.send_notification(this.backendError(err, 'Could not upload the transcript'), 'error'),
      complete: () => this.cdr.markForCheck()
    });
  }

  // reloads the transcript document after a successful upload
  private reloadTranscript() {
    this.applicationsApi.listApplicationDocuments(this.editApplicationId).subscribe({
      next: res => {
        const tor = res.find(d => d.document_type === 'transcript');
        if (tor) this.existingTranscript = tor;
      },
      error: err => console.error(err),
      complete: () => this.cdr.markForCheck()
    });
  }
}

interface ExamPair {
  local_exam_id: number;
  host_exam_id: number;
  // id of the mapped_exams row this pair comes from (edit mode only)
  mapping_id?: number;
  // decision info coming from the existing mapping (used to show a rejection note)
  status?: string;
  notes?: string;
  // exam result filled in by the student during 'exam_recognition'
  grade?: number | null;
  date_passed?: string;
}

// immutable snapshot of a mapped_exams row as loaded from the backend
interface LoadedMapping {
  id: number;
  sending_exam_id: number;
  host_exam_id: number;
}
