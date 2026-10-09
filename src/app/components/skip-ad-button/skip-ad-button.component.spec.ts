import { SimpleChange } from '@angular/core';
import { Subject, of } from 'rxjs';

import { PostsService } from 'app/posts.services';
import { SkipAdButtonComponent } from './skip-ad-button.component';

describe('SkipAdButtonComponent', () => {
  let component: SkipAdButtonComponent;
  let postsService: jasmine.SpyObj<PostsService>;
  const syntheticVideo = {url: 'watch?v=abcdefghijk'};

  beforeEach(() => {
    postsService = jasmine.createSpyObj<PostsService>('PostsService', ['getSponsorBlockDataForVideo']);
    component = new SkipAdButtonComponent(postsService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('is safe before a current video is available', () => {
    component.current_video = null;

    component.skipAdButtonCheck();

    expect(component.show_skip_ad_button).toBe(false);
    expect(postsService.getSponsorBlockDataForVideo).not.toHaveBeenCalled();
  });

  it('does not overlap SponsorBlock requests for the same video', () => {
    const response = new Subject<any>();
    postsService.getSponsorBlockDataForVideo.and.returnValue(response.asObservable());

    component.checkSponsorBlock(syntheticVideo);
    component.checkSponsorBlock(syntheticVideo);

    expect(postsService.getSponsorBlockDataForVideo).toHaveBeenCalledTimes(1);

    response.next([]);
    response.complete();
    expect(component.sponsor_block_cache[syntheticVideo.url]).toBeNull();
  });

  it('cancels active requests when the current video changes', () => {
    const response = new Subject<any>();
    postsService.getSponsorBlockDataForVideo.and.returnValue(response.asObservable());
    component.current_video = syntheticVideo;
    component.checkSponsorBlock(syntheticVideo);
    component.show_skip_ad_button = true;

    component.ngOnChanges({
      current_video: new SimpleChange(syntheticVideo, {url: 'watch?v=lmnopqrstuv'}, false)
    });

    expect(response.observers.length).toBe(0);
    expect(component.show_skip_ad_button).toBe(false);
  });

  it('caches completed SponsorBlock results by video', () => {
    postsService.getSponsorBlockDataForVideo.and.returnValue(of([{
      videoID: 'abcdefghijk',
      segments: [{segment: [5, 10]}]
    }]));

    component.checkSponsorBlock(syntheticVideo);
    component.checkSponsorBlock(syntheticVideo);

    expect(postsService.getSponsorBlockDataForVideo).toHaveBeenCalledTimes(1);
    expect(component.sponsor_block_cache[syntheticVideo.url].videoID).toBe('abcdefghijk');
  });

  it('cancels active requests when destroyed', () => {
    const response = new Subject<any>();
    postsService.getSponsorBlockDataForVideo.and.returnValue(response.asObservable());
    component.checkSponsorBlock(syntheticVideo);

    component.ngOnDestroy();

    expect(response.observers.length).toBe(0);
    expect(Object.keys(component.sponsor_block_requests)).toEqual([]);
  });
});
