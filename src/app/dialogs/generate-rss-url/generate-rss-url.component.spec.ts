import { Clipboard } from '@angular/cdk/clipboard';
import { Router, UrlSerializer } from '@angular/router';
import { PostsService } from 'app/posts.services';
import { GenerateRssUrlComponent } from './generate-rss-url.component';

describe('GenerateRssUrlComponent', () => {
  let component: GenerateRssUrlComponent;

  beforeEach(() => {
    const postsService = {
      config: {Host: {url: 'http://localhost', port: 17442}},
      isLoggedIn: false
    } as PostsService;
    const router = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);
    const serializer = jasmine.createSpyObj<UrlSerializer>('UrlSerializer', ['serialize']);
    router.createUrlTree.and.returnValue({} as any);
    serializer.serialize.and.returnValue('');

    component = new GenerateRssUrlComponent(
      postsService,
      router,
      serializer,
      {} as Clipboard
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('provides a localized name for copying the generated URL', () => {
    expect(component.copyUrlLabel).toBe('Copy to clipboard');
  });
});
