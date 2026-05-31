import { Routes } from '@angular/router';

import { ApplicationsList } from './applications-list/applications-list';

export const routes: Routes = [
  {
    path: "applications",
    title: "Applications",
    component: ApplicationsList
  },
];
