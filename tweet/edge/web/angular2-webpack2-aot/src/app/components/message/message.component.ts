import { Component, OnInit } from '@angular/core';
import './message.component.styl';
import { MessageService } from './message.service';

@Component({
  selector: 'twitter-message',
  templateUrl: './message.component.html',
})
export class MessageComponent implements OnInit {

  constructor(private messageService: MessageService) {
  }

  public ngOnInit() {
  }

  public sendMessage($event: any): void {

    const element: HTMLInputElement = $event.target;

    this.messageService.sendMessage(element.value).subscribe(
      ok => ok,
      err => console.log(`oops: ${err}`),
      () => element.value = '' // complete
    );
  }
}
