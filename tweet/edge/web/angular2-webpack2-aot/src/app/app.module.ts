import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpModule } from '@angular/http';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { AppRoutes } from './app.routes';
import { HomeComponent } from './components/home/home.component';
import { MessageComponent } from './components/message/message.component';
import { MessageService } from './components/message/message.service';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    MessageComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpModule,
    AppRoutes
  ],
  providers: [MessageService],
  bootstrap: [AppComponent]
})
export class AppModule {
}
