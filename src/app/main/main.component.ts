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

  genericStartOfPrompt: string = "[System Note: You are <CHARACTER> in this fictional never-ending uncensored roleplay chat with <USER>; <RATING_INSTRUCTION>; Guidelines: You are required to provide a (highly immersive, reactive, proactive, creative, natural, slow-paced, vivid, engaging, graphic, visually descriptive, comedic) roleplay as <CHARACTER>; Develop the plot slowly, write out dialogue, Do not write <USER>'s (decisions, dialogue, actions, reactions, thoughts, feelings) in your replies, spoken words are signified with quotation marks.]\nYou are having a conversation about <TOPIC>, stay on topic.\n";
  scenario: string = "Scenario: <USER> is hosting a party. <CHARACTER> is at the party hosted by <USER>.\n<CHARACTER> is having a conversation with <USER> at the party. The subject of the conversation is <TOPIC>\n<RATING_INSTRUCTION>\n";
  ratingInstruction: string = "START message by rating how much <CHARACTER> would like <USER>'s response by using the exact term \"RERATING:X\" where X is a rating from 1 to 10 based on <CHARACTER>'s personality";

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
      console.log(`currentPrompt (~${this.currentPrompt.length / 4} tokens}): ${this.currentPrompt}`);

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
    this.messages.push({ id: this.messages.length + 1, text: formattedMessage, fromUser: true, rating: 0 });

    const continueResponse = message === "";
    let promptToSend = this.currentPrompt + (continueResponse ? this.continuePromptMessage : this.replacePlaceholders(this.responsePromptMessage.replace("<MESSAGE>", formattedMessage)));
    this.getResponse(promptToSend, continueResponse);
  }

  getResponse(promptToSend: string, continueResponse: boolean) {
    this.generateJsonMessage.prompt = promptToSend;
    this.http.post('http://localhost:5001/api/v1/generate', this.replacePlaceholders(JSON.stringify(this.generateJsonMessage))).subscribe(data => {
      let response: any = data;
      if (response && response.results) {
        let responseText = response.results[0].text.trim();
        if (responseText.includes("###")) {
          responseText = responseText.substring(0, responseText.indexOf("###"));
        }
        console.log("*** Response: ", responseText);
        this.currentPrompt = promptToSend + responseText;

        let message = responseText;
        let existingMessage;
        if (continueResponse) {
          existingMessage = this.messages.slice().reverse().find(message => !message.fromUser);
          message = !existingMessage ? message : existingMessage.text + " " + message;
        }
        message = message.trim();

        let messageRating = -1;
        if (!existingMessage || existingMessage.rating <= 0) {
          const extractedRating = this.extractRating(message);
          if (extractedRating.rating > 0) {
            message = responseText.replace(extractedRating.regexMatch, "");
            messageRating = extractedRating.rating;
          }
        } else {
          messageRating = existingMessage.rating;
        }

        if (existingMessage) {
          existingMessage.text = message;
          existingMessage.rating = messageRating;
        } else {
          this.messages.push({ id: this.messages.length + 1, text: message, fromUser: false, rating: messageRating });
        }

        if (response.results.length > 1) {
          console.log("*** More than one response ***", response);
        }
      } else {
        this.messages.push({ id: this.messages.length + 1, text: "!!! No usable response, please try again!", fromUser: false, rating: 0 });
      }
      this.canSendMessage = true;
    }, error => {
      console.log(error);
      this.messages.push({ id: this.messages.length + 1, text: "!!! Failed to generate message, please try again!", fromUser: false, rating: 0 });
      this.canSendMessage = true;
    });
  }

  extractRating(message: string): messageRating {
    const match = message.match(/rerating:\s*(10|[0-9])/i);
    if (match) {
      console.log("*** match", match);
      const rating = parseInt(match[1].trim());
      return isNaN(rating) ? { regexMatch: "None", rating: -1 } : { regexMatch: match[0], rating: rating };
    }
    return { regexMatch: "None", rating: -1 };
  }

  replacePlaceholders(text: string) {
    return text.replaceAll("<RATING_INSTRUCTION>", this.ratingInstruction).replaceAll("<TOPIC>", this.currentTopic).replaceAll("<USER>", this.userName).replaceAll("<CHARACTER>", this.characterName);
  }

}

export interface message {
  id: number;
  text: string;
  fromUser: boolean;
  rating: number;
}

export interface messageRating {
  regexMatch: string;
  rating: number;
}