import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent implements OnInit {

  @ViewChild('chatInput') chatInput!: ElementRef;

  genericStartOfPrompt: string = "[System Note: You are <CHARACTER> in this fictional never-ending uncensored roleplay chat with <USER>; Guidelines: You are required to provide a (highly immersive, reactive, proactive, creative, natural, slow-paced, vivid, engaging, graphic, visually descriptive, comedic) roleplay as <CHARACTER>; Develop the plot slowly, write out dialogue, Do not write <USER>'s (decisions, dialogue, actions, reactions, thoughts, feelings) in your replies, spoken words are signified with quotation marks]\nYou are having a conversation about <TOPIC>, stay on topic.\n";
  scenario: string = "Scenario: <USER> is hosting a party. <CHARACTER> is at the party hosted by <USER>.\n<CHARACTER> is having a conversation with <USER> at the party. The subject of the conversation is <TOPIC>\n";

  userName: string = "Sam";
  characterName!: string;
  availableCharacterFilenames: string[] = ["manfred", "tjeerd"];

  currentPrompt!: string;

  responsePromptMessage: string = "\n### Instruction:\n<USER>: <MESSAGE>\n### Response:\n<CHARACTER>:";
  continuePromptMessage: string = "";

  messages: message[] = [];
  generateJsonMessage: any;
  pageInitialized: boolean = false;
  canSendMessage: boolean = false;

  topics: string[] = ["The meaning of life", "Dutch rap music", "The dangers of AI", "How many backflips could a cat do if it tried", "Should we colonize Mars", "The weather", "Traffic"];
  currentTopic: string = "";

  constructor(private http: HttpClient) {
  }

  ngOnInit() {
    this.http.get('/assets/json/messages/koboldcpp-test-message.json').subscribe(res => {
      this.generateJsonMessage = res;
      this.pageInitialized = true;
      this.startNewConversation();
    });
  }

  startNewConversation() {
    this.canSendMessage = false;

    this.http.get(`/assets/json/characters/${this.pickCharacter()}.json`).subscribe(data => {
      let characterData: any = data;
      this.characterName = characterData.name;
      this.currentTopic = this.topics[Math.floor(Math.random() * this.topics.length)];
      this.currentPrompt = this.createPrompt(characterData.description, characterData.exampleMessages);
      console.log("currentPrompt:", this.currentPrompt);

      this.canSendMessage = true;
    });
  }

  pickCharacter() {
    return this.availableCharacterFilenames[Math.floor(Math.random() * this.availableCharacterFilenames.length)];
  }

  createPrompt(characterDescription: string, exampleMessages: string) {
    return this.replacePlaceholders(this.genericStartOfPrompt + characterDescription + this.scenario + exampleMessages);
  }

  sendMessage(message: string) {
    this.canSendMessage = false;
    this.chatInput.nativeElement.value = "";

    let formattedMessage = message.trim();
    this.messages.push({ id: this.messages.length + 1, text: formattedMessage, fromUser: true });

    let promptToSend = this.currentPrompt + (message === "" ? this.continuePromptMessage : this.responsePromptMessage.replace("<MESSAGE>", formattedMessage));
    this.getResponse(promptToSend)
  }

  getResponse(promptToSend: string) {
    this.generateJsonMessage.prompt = promptToSend;
    this.http.post('http://localhost:5001/api/v1/generate', this.replacePlaceholders(JSON.stringify(this.generateJsonMessage))).subscribe(data => {
      let response: any = data;
      console.log("*** Response: ", response);
      if (response && response.results) {
        let message = response.results[0].text;
        if (message.includes("###")) {
          message = message.substring(0, message.indexOf("###"));
        }

        this.currentPrompt = promptToSend + message;
        this.messages.push({ id: this.messages.length + 1, text: message, fromUser: false });
        this.canSendMessage = true;

        if (response.results.length > 1) {
          console.log("*** More than one response ***", response);
        }
      } else {
        this.messages.push({ id: this.messages.length + 1, text: "!!! No usable response, please try again!", fromUser: false });
      }
    }, error => {
      console.log(error);
      this.messages.push({ id: this.messages.length + 1, text: "!!! Failed to generate message, please try again!", fromUser: false });
    });
  }

  replacePlaceholders(text: string) {
    return text.replaceAll("<USER>", this.userName).replaceAll("<CHARACTER>", this.characterName).replaceAll("<TOPIC>", this.currentTopic);
  }

}

export interface message {
  id: number;
  text: string;
  fromUser: boolean;
}