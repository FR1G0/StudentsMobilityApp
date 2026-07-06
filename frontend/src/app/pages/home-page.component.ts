import { isPlatformBrowser } from '@angular/common';
import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService, DashboardSummary, HealthResponse } from '../api.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  template: `
    <section class="space-y-6">
      <div class="rounded-2xl border border-border-default bg-bg-surface p-6">
        <p class="text-xs uppercase tracking-[0.24em] text-text-muted">Flask API</p>
        <h1 class="mt-2 text-2xl font-semibold text-text-primary">Students Mobility dashboard</h1>
        <p class="mt-2 max-w-2xl text-text-secondary">
          Data live from PostgreSQL via Flask. Page reads API summary, recent applications, and institution stats.
        </p>
      </div>

      @if (error(); as message) {
        <div class="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-100">
          {{ message }}
        </div>
      }

      @if (loading()) {
        <div class="rounded-xl border border-border-default bg-bg-surface p-4 text-text-secondary">
          Loading backend data...
        </div>
      } @else if (summary(); as data) {
        <div class="grid gap-4 md:grid-cols-4">
          <div class="rounded-xl border border-border-default bg-bg-surface p-4">
            <p class="text-xs uppercase tracking-[0.2em] text-text-muted">Users</p>
            <p class="mt-2 text-2xl font-semibold">{{ data.counts.users }}</p>
          </div>
          <div class="rounded-xl border border-border-default bg-bg-surface p-4">
            <p class="text-xs uppercase tracking-[0.2em] text-text-muted">Institutions</p>
            <p class="mt-2 text-2xl font-semibold">{{ data.counts.institutions }}</p>
          </div>
          <div class="rounded-xl border border-border-default bg-bg-surface p-4">
            <p class="text-xs uppercase tracking-[0.2em] text-text-muted">Applications</p>
            <p class="mt-2 text-2xl font-semibold">{{ data.counts.applications }}</p>
          </div>
          <div class="rounded-xl border border-border-default bg-bg-surface p-4">
            <p class="text-xs uppercase tracking-[0.2em] text-text-muted">Exams</p>
            <p class="mt-2 text-2xl font-semibold">{{ data.counts.exams }}</p>
          </div>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <div class="rounded-2xl border border-border-default bg-bg-surface p-5">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold">Recent applications</h2>
              <span class="text-xs text-text-muted">{{ data.recent_applications.length }} rows</span>
            </div>

            <div class="mt-4 space-y-3">
              @for (application of data.recent_applications; track application.id) {
                <article class="rounded-xl border border-border-subtle bg-bg-base p-4">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <p class="font-medium text-text-primary">{{ application.student_name }}</p>
                      <p class="text-xs text-text-muted">{{ application.student_email }}</p>
                    </div>
                    <span class="rounded-full border border-border-strong px-2 py-1 text-xs text-text-secondary">
                      {{ application.status }}
                    </span>
                  </div>

                  <div class="mt-3 text-sm text-text-secondary">
                    Year {{ application.year }} · {{ application.semester }}
                  </div>
                  <div class="text-xs text-text-muted">
                    {{ application.sending_institution_name }} → {{ application.host_institution_name }}
                  </div>
                  @if (application.date_submitted) {
                    <div class="mt-2 text-xs text-text-muted">
                      Submitted {{ application.date_submitted }}
                    </div>
                  }
                </article>
              } @empty {
                <p class="rounded-xl border border-dashed border-border-subtle p-4 text-sm text-text-muted">
                  No applications returned by API.
                </p>
              }
            </div>
          </div>

          <div class="space-y-4">
            <div class="rounded-2xl border border-border-default bg-bg-surface p-5">
              <h2 class="text-lg font-semibold">Top institutions</h2>
              <div class="mt-4 space-y-3">
                @for (institution of data.top_institutions; track institution.id) {
                  <div class="flex items-center justify-between rounded-xl border border-border-subtle bg-bg-base p-4">
                    <div>
                      <p class="font-medium">{{ institution.name }}</p>
                      <p class="text-xs text-text-muted">{{ institution.city }}, {{ institution.country }}</p>
                    </div>
                    <span class="text-xs text-text-secondary">{{ institution.partner_count }} partners</span>
                  </div>
                } @empty {
                  <p class="text-sm text-text-muted">No partner institutions found.</p>
                }
              </div>
            </div>

            @if (health(); as apiHealth) {
              <div class="rounded-2xl border border-border-default bg-bg-surface p-5">
                <h2 class="text-lg font-semibold">Database status</h2>
                <p class="mt-2 text-sm text-text-secondary">Database: {{ apiHealth.database_name }}</p>
                <p class="text-sm text-text-secondary">Version: {{ apiHealth.database_version }}</p>
                <p class="mt-2 text-xs text-text-muted">API status: {{ apiHealth.status }}</p>
              </div>
            }
          </div>
        </div>
      }
    </section>
  `,
})
export class HomePageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly platformId = inject(PLATFORM_ID);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly health = signal<HealthResponse | null>(null);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    void this.loadData();
  }

  private async loadData(): Promise<void> {
    try {
      const [summary, health] = await Promise.all([
        firstValueFrom(this.api.getSummary()),
        firstValueFrom(this.api.getHealth()),
      ]);

      this.summary.set(summary);
      this.health.set(health);
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
