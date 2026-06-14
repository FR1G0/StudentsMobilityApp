import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-application-form',
  imports: [CommonModule,FormsModule],
  templateUrl: './application-form.html',
  styleUrl: './application-form.css',
})
export class ApplicationForm {

  // different roles have access to different actions (create, edit)
  action: string = "create";

  // must be fetched form backend using the student's instution id -> intitutions partners
  application : FullApplicationInterface = {
    host_istitution : {} as InstitutionData,
    referent : {} as ReferentData
  } as FullApplicationInterface;

  institutions: InstitutionData[] = [
    { id: 1, name: "TU Berlin" },
    { id: 2, name: "ETH Zürich" },
    { id: 3, name: "KU Leuven" },
    { id: 4, name: "Universidad Complutense de Madrid" },
    { id: 5, name: "University of Warsaw" }
  ];

  // fetched from backend
  examPairs: ExamPair[] = [
      { local: '', host: '' }  // start with one empty row
    ];

  addExamPair(): void {
    this.examPairs.push({ local: '', host: '' });
  }

  removeExamPair(index: number): void {
    if (this.examPairs.length > 1) {
      this.examPairs.splice(index, 1);
    }
  }
}

export interface FullApplicationInterface {
  firstname: string;
  lastname : string;
  email : string;
  academic_year : number; // 2026, which then becomes 2026/2027
  start_date: string;
  end_date: string;
  referent: ReferentData;
  host_istitution: InstitutionData;
}

interface InstitutionData {
  id: number;
  name: String;
}

interface ReferentData {
  id: number;
  name: String;
}

interface ExamData {
  id: number;
  name: String;
  credits: number;
}

interface ExamPair {
  local: String;
  host: String;
}

