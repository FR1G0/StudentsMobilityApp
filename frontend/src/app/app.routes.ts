import { Routes } from '@angular/router';

import { ApplicationsList } from './applications-list/applications-list';
import { ApplicationForm } from './application-form/application-form';
import { AppLogin } from './app-login/app-login';
import { AppHome } from './app-home/app-home';

export const routes: Routes = [
  {
    path: "home",
    title: "SMA - Homepage",
    component: AppHome
  },
  {
    path: "login",
    title: "SMA - Login",
    component: AppLogin
  },
  {
    path: "applications",
    title: "SMA - List Applications",
    component: ApplicationsList
  },
  {
    path: "form",
    title: "SMA - Application",
    component: ApplicationForm
  }
];
