import { browser, by, element } from 'protractor';

export class TweetQueryWebPage {
  navigateTo() {
    return browser.get('/');
  }

  getParagraphText() {
    return element(by.css('twitter-root h1')).getText();
  }
}
