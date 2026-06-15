import { TestBed } from '@angular/core/testing';

import { Applications } from './applications';

describe('Applications', () => {
  let service: Applications;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Applications);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
