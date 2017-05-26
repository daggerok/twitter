import {Injectable} from '@angular/core';
import {Headers, Http, RequestOptions, Response} from '@angular/http';
import {Observable} from 'rxjs/Observable';
import 'rxjs/Rx';

@Injectable()
export class MessageService {

  constructor(private http: Http) {
  }

  public sendMessage(payload: string): Observable<Response> {

    const options: RequestOptions = new RequestOptions({
      headers: new Headers({'Content-Type': 'application/json',}),
    });

    return this.http.post('/api/messages', {payload}, options)
      .map(response => response || {})
      .catch(error => Observable.throw(error));
  }
}
