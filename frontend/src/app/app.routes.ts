import { Routes } from '@angular/router';

import { ApplicationsList } from './applications-list/applications-list';
import { ApplicationForm } from './application-form/application-form';
import { ApplicationView } from './application-view/application-view';
import { AppLogin } from './app-login/app-login';
import { ManageUsers } from './manage-users/manage-users';
import { ManagePartners } from './manage-partners/manage-partners';
import { ManageExams } from './manage-exams/manage-exams';
import { AppHome } from './app-home/app-home';

export const routes: Routes = [
  {
    path: "",
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
  },
  {
    path: "form-modify",
    title: "SMA - Application",
    component: ApplicationForm
  },
  {
    path: "application-view",
    title: "SMA - View Application",
    component: ApplicationView
  },
  {
    path: "manage-users",
    title: "SMA - Manage Users",
    component: ManageUsers
  },
  {
    path: "manage-partners",
    title: "SMA - Manage Partners",
    component: ManagePartners
  },
  {
    path: "manage-exams",
    title: "SMA - Manage Exams",
    component: ManageExams
  }
];
