import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { YoutubeSearchService } from './youtube-search.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('YoutubeSearchService', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptorsFromDi()),
      provideHttpClientTesting()
    ]
  }));

  it('should be created', () => {
    const service = TestBed.inject(YoutubeSearchService);
    expect(service).toBeTruthy();
  });
});
