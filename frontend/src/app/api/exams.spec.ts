import { TestBed } from '@angular/core/testing';

import { Exams } from './exams';

describe('Exams', () => {
  let service: Exams;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Exams);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
