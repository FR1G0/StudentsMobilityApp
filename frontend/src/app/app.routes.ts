import { Routes } from '@angular/router';

import { ApplicationsList } from './applications-list/applications-list';
import { ApplicationForm } from './application-form/application-form';

export const routes: Routes = [
  {
    path: "applications",
    title: "Applications",
    component: ApplicationsList
  },
  {
    path: "form",
    title: "Application",
    component: ApplicationForm
  }
];
