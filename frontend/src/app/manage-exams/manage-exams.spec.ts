import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageExams } from './manage-exams';

describe('ManageExams', () => {
  let component: ManageExams;
  let fixture: ComponentFixture<ManageExams>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageExams],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageExams);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
