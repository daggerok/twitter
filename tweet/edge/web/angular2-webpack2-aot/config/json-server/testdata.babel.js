import { _links, page, projects } from './mocks';

export default () => ({
  "projects": {
    _embedded: {
      projects,
      _links,
      page,
    }
  }
});
