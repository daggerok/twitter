export default class BookmarkModel {
  constructor($http, $log, HateoasService) {
    'ngInject';
    this.$http = $http;
    this.$log = $log;
    this.HateoasService = HateoasService;
  }

  static uri() {
    return '/api/bookmarks';
  }

  getBookmarks() {
    return this.$http.get(BookmarkModel.uri()).then(
      ok => this.HateoasService.bookmarks(ok),
      this.$log.error
    );
  }
}
