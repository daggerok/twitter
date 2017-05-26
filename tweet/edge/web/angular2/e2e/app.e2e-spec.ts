import {TweetQueryWebPage} from './app.po';

describe('tweet-query-web App', () => {
  let page: TweetQueryWebPage;

  beforeEach(() => {
    page = new TweetQueryWebPage();
  });

  it('should display message saying app works', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('twitter :)');
  });
});
