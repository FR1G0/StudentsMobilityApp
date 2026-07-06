import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { NgClass, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { App } from '../app';
import { Applications, Application, ApplicationInfo } from '../api/applications';

@Component({
  selector: 'app-applications-list',
  imports: [FormsModule, NgClass],
  templateUrl: './applications-list.html',
  styleUrl: './applications-list.css',
})
export class ApplicationsList implements OnInit {
  constructor(
    private applicationsApi: Applications,
    private app : App,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  inputSearch: string = '';
  inputFilterBy: string = 'all';
  isLoading = true;

  // applications already joined with institutions, applicant and referent data
  applications: ApplicationInfo[] = [];

  // id of the application whose action menu is currently open (null = none)
  openMenuId: number | null = null;

  // role of the logged user, decides which actions are available
  get role(): string {
    return this.app.user_data ? this.app.user_data.role : '';
  }

  filterOptions: FilterOption[] = [
    { id: 'all',                        name: 'All' },
    { id: 'created',                    name: 'Created' },
    { id: 'learning_agreement_pending', name: 'LA Pending' },
    { id: 'pre_departure_completed',    name: 'Pre-Departure' },
    { id: 'mobility_ongoing',           name: 'Ongoing' },
    { id: 'exam_recognition',           name: 'Exam Recognition' },
    { id: 'closed',                     name: 'Closed' }
  ];

  ngOnInit() {
    if(!isPlatformBrowser(this.platformId)) { return; }
    // single joined route: applications already carry institution/applicant data
    this.applicationsApi.getApplicationsInfo().subscribe({
      next: res => {
        this.applications = res;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        console.error(err);
        // when the request fails, show the message returned by the backend
        let message = 'could not load applications';
        if (err.error && err.error.error) {
          message = err.error.error;
        }
        this.app.send_notification(message, 'error');
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // opens/closes the action dropdown menu of a single application row
  toggleMenu(id: number, event: Event) {
    event.stopPropagation();
    if (this.openMenuId === id) {
      this.openMenuId = null;
    } else {
      this.openMenuId = id;
    }
  }

  closeMenu() {
    this.openMenuId = null;
  }

  get filteredApplications(): ApplicationInfo[] {
    return this.applications
      .filter(a => this.inputFilterBy === 'all' || a.status === this.inputFilterBy)
      .filter(a => {
        if (!this.inputSearch) return true;
        const q = this.inputSearch.toLowerCase();
        return (a.sending?.name.toLowerCase().includes(q) ?? false) ||
               (a.host?.name.toLowerCase().includes(q) ?? false);
      });
  }

  formatYear(year: number): string {
    return `${year}/${year + 1}`;
  }

  shortenStatus(status: string): string {
    if(status=='learning_agreement_pending') return 'la pending';
    if(status=='pre_departure_completed') return 'pre dept completed';
    if(status=='exam_recognition') return 'exam recognition';
    if(status=='mobility_ongoing') return 'ongoing';
    if(status=='closed') return 'closed';
    return status;
  }

  viewApplication(application: Application) {
    this.router.navigate(['/application-view'], { state: { application } });
  }

  editApplication(application: Application) {
    this.router.navigate(['/form-modify'], { state: { application, mode: 'edit' } });
  }

  deleteApplication(application: Application) {
    if (!isPlatformBrowser(this.platformId)) { return; }
    const confirmed = window.confirm('Delete application #' + application.id + '? This cannot be undone.');
    if (!confirmed) { return; }

    this.applicationsApi.deleteApplication(application.id).subscribe({
      next: res => {
        if (res.status === 'success') {
          this.applications = this.applications.filter(a => a.id !== application.id);
          this.app.send_notification('Application #' + application.id + ' deleted', 'success');
        } else {
          this.app.send_notification(res.error || 'deleting error','error');
          console.error(res.error);
        }
      },
      error: err => {
        console.error(err);
        // when the request fails, show the message returned by the backend
        let message = 'deleting error';
        if (err.error && err.error.error) {
          message = err.error.error;
        }
        this.app.send_notification(message, 'error');
      },
      complete: () => this.cdr.markForCheck()
    });
  }
}

interface FilterOption {
  id: string;
  name: string;
}
