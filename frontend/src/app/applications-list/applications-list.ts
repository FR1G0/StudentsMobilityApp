import { Component } from '@angular/core';

import { NgClass } from '@angular/common'
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-applications-list',
  imports: [FormsModule,NgClass],
  templateUrl: './applications-list.html',
  styleUrl: './applications-list.css',
})
export class ApplicationsList {


  InputSearch: String = "";
  InputFilterBy: String = "all";

  // mock data, must be fetched from backend
ApplicationsArray: ApplicationPreviewData[] = [
  { id: "87371", name: "Application 1", referentName: "prof. Example", email: "student@email.com", status: "draft" },
  { id: "22311", name: "Application 2", referentName: "prof. Example", email: "student@email.com", status: "awaiting-la" },
  { id: "55283", name: "Application 3", referentName: "prof. Example", email: "student@email.com", status: "departure" },
  { id: "13947", name: "Application 4", referentName: "prof. Example", email: "student@email.com", status: "in-progress" },
  { id: "67432", name: "Application 5", referentName: "prof. Example", email: "student@email.com", status: "recognition" },
  { id: "39104", name: "Application 6", referentName: "prof. Example", email: "student@email.com", status: "rejected" },
  { id: "80256", name: "Application 7", referentName: "prof. Example", email: "student@email.com", status: "closed" }
];

  // filtering options
  FilterOptions: Filter[] = [
    { id: "all", name: "All" },
    { id: "draft", name: "Draft" },
    { id: "awaiting-la", name: "Awaiting LA" },
    { id: "departure", name: "Departure" },
    { id: "in-progress", name: "In Progress" },
    { id: "recognition", name: "Recognition" },
    { id: "rejected", name: "Rejected" },
    { id: "closed", name: "Closed" }
  ];
}

interface Filter {
  id: String;
  name: String;
}

export interface ApplicationPreviewData {
  id: String;
  name: String;
  email: String;
  referentName: String;
  status: String;
}
