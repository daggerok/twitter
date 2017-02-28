import { Injectable } from '@angular/core';
import {
  Http,
  Headers,
} from '@angular/http';
import { Observable } from 'rxjs';
import 'rxjs/Rx';

@Injectable()
export class MessageService {
  private static headers: Headers = new Headers({
    'Content-Type': 'application/json'
  });

  constructor(private http: Http) {}

  public sendMessage(payload: string): Observable<any> {
    console.log(`sending ${payload}`);
    return this.http.post('/api/messages', { payload }, MessageService.headers)
      .map(res => res.json() || {})
      .catch((e: any) => {
        console.log('=\\', e.message ? e.message : e.toString());
        return e;
      });
  }
}
