import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManagePartners } from './manage-partners';

describe('ManagePartners', () => {
  let component: ManagePartners;
  let fixture: ComponentFixture<ManagePartners>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagePartners],
    }).compileComponents();

    fixture = TestBed.createComponent(ManagePartners);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
