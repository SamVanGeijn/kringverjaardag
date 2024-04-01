import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {

  @ViewChild('chatInput') chatInput!: ElementRef;

  messages: message[] = [];

  constructor() { }

  sendMessage(message: string) {
    this.messages.push({ id: this.messages.length + 1, text: message, fromUser: true });
    this.messages.push({ id: this.messages.length + 1, text: "< ANTWOORD >", fromUser: false });
    this.chatInput.nativeElement.value = "";
  }

}

export interface message {
  id: number;
  text: string;
  fromUser: boolean;
}