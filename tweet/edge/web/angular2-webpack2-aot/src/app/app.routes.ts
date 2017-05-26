import {RouterModule} from '@angular/router';

import {HomeComponent} from './components/home/home.component';
import {MessageComponent} from './components/message/message.component';

export const AppRoutes = RouterModule.forRoot([
  {
    path: '',
    component: HomeComponent,
  },
  {
    path: 'message',
    component: MessageComponent,
  },
  {
    path: '**',
    redirectTo: '/',
  },
]);
