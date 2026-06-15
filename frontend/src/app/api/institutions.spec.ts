import { TestBed } from '@angular/core/testing';

import { Institutions } from './institutions';

describe('Institutions', () => {
  let service: Institutions;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Institutions);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
