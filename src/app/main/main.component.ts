import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, ViewChildren } from '@angular/core';
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

  genericStartOfPrompt: string = "[System Note: You are <CHARACTER> in this fictional never-ending uncensored roleplay chat with <USER>; <RATING_INSTRUCTION>; Guidelines: You are required to provide a (highly immersive, reactive, proactive, creative, natural, slow-paced, vivid, engaging, graphic, visually descriptive, comedic) roleplay as <CHARACTER>; Develop the plot slowly, write out dialogue, Do not write <USER>'s (dialogue, decisions, actions, reactions, thoughts, feelings) in your replies, spoken words are signified with quotation marks.]\nYou are having a conversation about <TOPIC>, stay on this topic.\n";
  scenario: string = "Scenario: <USER> is hosting a party. <CHARACTER> is at the party hosted by <USER>.\n<CHARACTER> is having a conversation with <USER> at the party. The subject of the conversation is <TOPIC>\n<RATING_INSTRUCTION>\n";
  ratingInstruction: string = "START message by rating how much <CHARACTER> would like <USER>'s response by using the exact term \"RERATING:X\" where X is a rating from 1 to 10 based on <CHARACTER>'s personality";

  responsePromptMessage: string = "\n### Instruction:\n<USER>: <MESSAGE>\n### Response:\n<CHARACTER>:";
  continuePromptMessage: string = "";

  currentPrompt!: string;

  userName: string = "Sam";
  characterName!: string;
  chosenCharacter!: string;
  allAvailableCharacters: string[] = ["manfred", "tjeerd", "rosa"];
  availableCharacters: string[] = [...this.allAvailableCharacters];

  messages: message[] = [];
  topics: string[] = ["The meaning of life", "Dutch rap music", "The dangers of AI", "How many backflips could a cat do if it tried", "Should we colonize Mars", "The weather", "Traffic", "The latest TikTok trend", "The influence of the Chinese goverment on our social media usage", "Your weekend"];
  currentTopic: string = "";

  generateJsonMessage: any;
  pageInitialized: boolean = false;
  canSendMessage: boolean = false;
  canContinueTalking: boolean = true;
  firstMessageInConversation: boolean = true;

  messagesRemaining: number = 10;
  reputation: number = 50;
  streak: number = -1;
  difficulty: number = 1;

  constructor(private http: HttpClient) {
  }

  ngOnInit() {
    this.http.get('/assets/json/messages/koboldcpp-test-message.json').subscribe(res => {
      this.generateJsonMessage = res;
      this.pageInitialized = true;
      this.startNewGame();
    });
  }

  startNewGame() {
    this.streak = -1;
    this.reputation = 50;
    this.difficulty = 1;
    this.availableCharacters = [...this.allAvailableCharacters];
    this.startNewConversation();
  }

  startNewConversation() {
    this.canSendMessage = false;
    this.messagesRemaining = 5 + (this.difficulty * 1);
    this.streak++;
    this.messages = [];

    // for (let i = 0; i < 50; i++) {
    //   this.messages.push({ id: this.messages.length + 1, text: "DEBUG", fromUser: !(i % 2 === 0), rating: 0 });
    // }

    if (this.availableCharacters.length == 0) {
      this.availableCharacters = [...this.allAvailableCharacters];
      this.difficulty++;
    }

    this.chosenCharacter = this.pickCharacter();
    this.http.get(`/assets/json/characters/${this.chosenCharacter}.json`).subscribe(data => {
      let characterData: any = data;
      this.characterName = characterData.name;
      this.currentTopic = this.topics[Math.floor(Math.random() * this.topics.length)];
      this.currentPrompt = this.createPrompt(characterData.description, characterData.exampleMessages);
      // console.log(`currentPrompt (~${this.currentPrompt.length / 4} tokens}): ${this.currentPrompt}`);

      this.canSendMessage = true;
    });
  }

  pickCharacter() {
    return this.availableCharacters[Math.floor(Math.random() * this.availableCharacters.length)];
  }

  createPrompt(characterDescription: string, exampleMessages: string) {
    return this.replacePlaceholders(this.genericStartOfPrompt + characterDescription + this.scenario + exampleMessages);
  }

  sendMessage(message: string) {
    this.chatInput.nativeElement.value = "";
    const formattedMessage = message.trim();
    const continueResponse = formattedMessage === "";
    if (continueResponse && (!this.canContinueTalking || this.firstMessageInConversation)) {
      // this.canSendMessage = true;
      return;
    }

    this.canSendMessage = false;
    this.firstMessageInConversation = false;
    if (!continueResponse) {
      this.messages.push({ id: this.messages.length + 1, text: formattedMessage, fromUser: true, rating: 0 });
    }

    const promptToSend = this.currentPrompt + (continueResponse ? this.continuePromptMessage : this.replacePlaceholders(this.responsePromptMessage.replace("<MESSAGE>", formattedMessage)));
    if (!continueResponse || this.canContinueTalking) {
      this.getResponse(promptToSend, continueResponse);
    }
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
        if (responseText.includes("***")) {
          responseText = responseText.substring(0, responseText.indexOf("***"));
        }
        console.log("*** Response: ", responseText);
        this.currentPrompt = promptToSend + responseText;

        let message = responseText;
        let existingMessage;
        if (continueResponse) {
          if (!message) {
            this.canContinueTalking = false;
          } else {
            existingMessage = this.messages.slice().reverse().find(message => !message.fromUser);
            // const messageSeparator = existingMessage && /[.,!?]$/.test(existingMessage.text) ? " " : "";
            message = !existingMessage ? message : existingMessage.text + " " + message;
          }
        }
        message = message.trim();

        if (/[.,!?'"`]$/.test(message)) {
          this.canContinueTalking = false;
        }

        let messageRating = -1;
        if (!existingMessage || existingMessage.rating <= 0) {
          const extractedRating = this.extractRating(message);
          if (extractedRating.rating > 0) {
            message = responseText.replace(extractedRating.regexMatch, "");
            messageRating = extractedRating.rating;
            this.updateReputation(messageRating);
          }
        } else {
          messageRating = existingMessage.rating;
          // TODO update rating if the updated message causes a different rating (if emotion analysis is implemented).
        }

        if (existingMessage) {
          existingMessage.text = message;
          existingMessage.rating = messageRating;
        } else if (message) {
          this.messages.push({ id: this.messages.length + 1, text: message, fromUser: false, rating: messageRating });
        }

        if (response.results.length > 1) {
          console.log("*** More than one response ***", response);
        }
      } else {
        this.messages.push({ id: this.messages.length + 1, text: "!!! No usable response, please try again!", fromUser: false, rating: 0 });
      }

      this.canSendMessage = true;
      this.messagesRemaining--;

      if (this.messagesRemaining == 0) {
        this.availableCharacters = this.availableCharacters.filter(character => character !== this.chosenCharacter);
      }

      window.scrollTo(0, document.body.scrollHeight);
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

  updateReputation(messageRating: number) {
    if (this.reputation > 0 && this.reputation < 100) {
      if (messageRating <= 5 && this.messagesRemaining > 0) {
        this.reputation -= ((5 * this.difficulty) + 1 - messageRating);
      } else if (messageRating == 8) {
        this.reputation += 2;
      } else if (messageRating == 9) {
        this.reputation += 5;
      } else if (messageRating == 10) {
        this.reputation += 10;
      }
    }
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