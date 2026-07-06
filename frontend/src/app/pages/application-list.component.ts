import { isPlatformBrowser } from '@angular/common';
import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService, DashboardApplication } from '../api.service';

@Component({
  selector: 'app-application-list',
  standalone: true,
  template: `
    <section class="space-y-6">
      <div class="rounded-2xl border border-border-default bg-bg-surface p-6">
        <p class="text-xs uppercase tracking-[0.24em] text-text-muted">Applications</p>
        <h1 class="mt-2 text-2xl font-semibold text-text-primary">Database-backed application list</h1>
        <p class="mt-2 max-w-2xl text-text-secondary">
          This page reads <code class="text-text-primary">/api/applications</code> and shows joined student,
          sending, and host institution data.
        </p>
      </div>

      @if (error(); as message) {
        <div class="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-100">
          {{ message }}
        </div>
      }

      @if (loading()) {
        <div class="rounded-xl border border-border-default bg-bg-surface p-4 text-text-secondary">
          Loading application rows...
        </div>
      } @else if (applications(); as rows) {
        <div class="overflow-hidden rounded-2xl border border-border-default bg-bg-surface">
          <table class="min-w-full border-collapse text-left text-sm">
            <thead class="bg-bg-base text-text-muted">
              <tr>
                <th class="px-4 py-3 font-medium">ID</th>
                <th class="px-4 py-3 font-medium">Student</th>
                <th class="px-4 py-3 font-medium">Year</th>
                <th class="px-4 py-3 font-medium">Semester</th>
                <th class="px-4 py-3 font-medium">Status</th>
                <th class="px-4 py-3 font-medium">Sending institution</th>
                <th class="px-4 py-3 font-medium">Host institution</th>
                <th class="px-4 py-3 font-medium">Submitted</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows; track row.id) {
                <tr class="border-t border-border-subtle">
                  <td class="px-4 py-3 text-text-secondary">{{ row.id }}</td>
                  <td class="px-4 py-3">
                    <div class="font-medium text-text-primary">{{ row.student_name }}</div>
                    <div class="text-xs text-text-muted">{{ row.student_email }}</div>
                  </td>
                  <td class="px-4 py-3 text-text-secondary">{{ row.year }}</td>
                  <td class="px-4 py-3 text-text-secondary">{{ row.semester }}</td>
                  <td class="px-4 py-3 text-text-secondary">{{ row.status }}</td>
                  <td class="px-4 py-3 text-text-secondary">{{ row.sending_institution_name }}</td>
                  <td class="px-4 py-3 text-text-secondary">{{ row.host_institution_name }}</td>
                  <td class="px-4 py-3 text-text-secondary">{{ row.date_submitted ?? 'n/a' }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" class="px-4 py-6 text-center text-text-muted">No applications returned by API.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class ApplicationListComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly platformId = inject(PLATFORM_ID);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly applications = signal<DashboardApplication[] | null>(null);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    void this.loadData();
  }

  private async loadData(): Promise<void> {
    try {
      const rows = await firstValueFrom(this.api.getApplications());
      this.applications.set(rows);
    } catch (error) {
      this.error.set(this.toMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  private toMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Backend request failed';
  }
}
