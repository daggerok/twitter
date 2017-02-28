import { Component, OnInit } from '@angular/core';
import { MessageService } from './message.service';

@Component({
  selector: 'twitter-message',
  templateUrl: './message.component.html',
  styleUrls: ['./message.component.styl']
})
export class MessageComponent implements OnInit {

  constructor(private messageService: MessageService) {}
  ngOnInit() {}

  public sendMessage($event: any): void {

    const element: HTMLInputElement = $event.target;

    this.messageService.sendMessage(element.value).subscribe(
      ok => console.log('handle', ok),
      err => console.log('f*ck', err)
    );
    element.value = '';
  }
}
