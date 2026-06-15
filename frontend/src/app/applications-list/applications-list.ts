import { Component, OnInit, ChangeDetectorRef} from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { Applications, Application } from '../api/applications';

@Component({
  selector: 'app-applications-list',
  imports: [FormsModule, NgClass],
  templateUrl: './applications-list.html',
  styleUrl: './applications-list.css',
})
export class ApplicationsList implements OnInit {
  constructor(
    private applicationsApi: Applications,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  inputSearch: string = '';
  inputFilterBy: string = 'all';
  isLoading = true;

  applications: Application[] = [];

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
    this.applicationsApi.getApplications().subscribe({
      next: res => {
        this.applications = res;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        console.error(err);
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get filteredApplications(): Application[] {
    return this.applications
      .filter(a => this.inputFilterBy === 'all' || a.status === this.inputFilterBy)
      .filter(a => {
        if (!this.inputSearch) return true;
        const q = this.inputSearch.toLowerCase();
        return String(a.id).includes(q) ||
               String(a.year).includes(q) ||
               a.semester.toLowerCase().includes(q) ||
               a.status.toLowerCase().includes(q) ||
               a.notes.toLowerCase().includes(q);
      });
  }

  formatYear(year: number): string {
    return `${year}/${year + 1}`;
  }

  editApplication(application: Application) {
    this.router.navigate(['/form'], { state: { application, mode: 'edit' } });
  }
}

interface FilterOption {
  id: string;
  name: string;
}
