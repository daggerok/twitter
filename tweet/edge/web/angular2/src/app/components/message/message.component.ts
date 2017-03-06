import { Component, OnInit } from '@angular/core';
import { MessageService } from './message.service';

@Component({
  selector: 'twitter-message',
  templateUrl: './message.component.html',
  styleUrls: ['./message.component.styl'],
})
export class MessageComponent implements OnInit {

  constructor(private messageService: MessageService) {}

  public ngOnInit() {}

  public sendMessage($event: any): void {

    const element: HTMLInputElement = $event.target;
    /*
    this.messageService.sendMessage(element.value).subscribe(
      ok => ok,
      err => console.log(`oops: ${err}`)
    );
    */
    this.messageService.sendMessage(element.value).subscribe();
    element.value = '';
  }
}
