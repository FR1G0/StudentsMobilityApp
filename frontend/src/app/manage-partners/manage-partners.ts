import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { App } from '../app';
import { Institutions, Institution, PartnerLink, PartnerInsertBody } from '../api/institutions';

@Component({
  selector: 'app-manage-partners',
  imports: [FormsModule],
  templateUrl: './manage-partners.html',
  styleUrl: './manage-partners.css',
})
export class ManagePartners implements OnInit {
  constructor(
    private institutionsApi: Institutions,
    private app: App,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  isLoading = true;

  // institution selected in the new partnership dropdown (0 = none)
  selectedPartnerId = 0;

  institutions: Institution[] = [];
  partners: PartnerLink[] = [];

  // institution of the logged staff member: partnerships start from it
  get institutionId(): number {
    return this.app.user_data.id_institution;
  }

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) { return; }

    // all institutions for the dropdown, excluding the staff one
    this.institutionsApi.getInstitutions().subscribe({
      next: res => {
        this.institutions = res.filter(i => i.id !== this.institutionId);
        this.cdr.markForCheck();
      },
      error: err => console.error(err)
    });

    this.loadPartners();
  }

  loadPartners() {
    this.institutionsApi.getInstitutionPartners(this.institutionId).subscribe({
      next: res => {
        this.partners = res;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.notifyError(err, 'could not load partnerships');
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // creates a new partnership between the staff institution and the selected one
  addPartnership() {
    if (!this.selectedPartnerId) {
      this.app.send_notification('select an institution', 'warning');
      return;
    }

    const body: PartnerInsertBody = {
      id_institution: this.institutionId,
      id_partner_institution: this.selectedPartnerId,
    };

    this.institutionsApi.insertPartnerInstitution(body).subscribe({
      next: res => {
        if (res.status === 'success') {
          this.app.send_notification('Partnership created', 'success');
          this.selectedPartnerId = 0;
          this.loadPartners();
        } else {
          this.app.send_notification(res.error || 'insert error', 'error');
        }
      },
      error: err => this.notifyError(err, 'insert error'),
      complete: () => this.cdr.markForCheck()
    });
  }

  removePartnership(partner: PartnerLink) {
    if (!isPlatformBrowser(this.platformId)) { return; }
    const confirmed = window.confirm('Remove the partnership with ' + partner.name + '? This cannot be undone.');
    if (!confirmed) { return; }

    this.institutionsApi.deletePartnerInstitution(partner.partner_row_id).subscribe({
      next: res => {
        if (res.status === 'success') {
          this.partners = this.partners.filter(p => p.partner_row_id !== partner.partner_row_id);
          this.app.send_notification('Partnership with ' + partner.name + ' removed', 'success');
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
