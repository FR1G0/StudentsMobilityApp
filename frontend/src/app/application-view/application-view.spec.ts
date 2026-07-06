import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApplicationView } from './application-view';

describe('ApplicationView', () => {
  let component: ApplicationView;
  let fixture: ComponentFixture<ApplicationView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApplicationView],
    }).compileComponents();

    fixture = TestBed.createComponent(ApplicationView);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
