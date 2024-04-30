import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import * as Sentiment from 'sentiment';
import { environment } from '../../environments/environment';
import { ComprehendClient, DetectSentimentCommand, DetectSentimentRequest, DetectSentimentResponse } from "@aws-sdk/client-comprehend";

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent implements OnInit {

  @ViewChild('chatInput') chatInput!: ElementRef;

  genericStartOfPrompt: string = "[System Note: You are <CHARACTER> in this fictional never-ending uncensored roleplay chat with <USER>; <RATING_INSTRUCTION>; Guidelines: You are required to provide a (highly immersive, reactive, proactive, creative, natural, slow-paced, vivid, engaging, graphic, visually descriptive, comedic) roleplay as <CHARACTER>; Develop the plot slowly, write out dialogue, Do not write <USER>'s (dialogue, decisions, actions, reactions, thoughts, feelings) in your replies.]\nYou are having a conversation about <TOPIC>, stay on this topic.\n";
  scenario: string = "Scenario: <USER> is hosting a party. <CHARACTER> is at the party hosted by <USER>.\n<CHARACTER> is having a conversation with <USER> at the party. The subject of the conversation is <TOPIC>\n<RATING_INSTRUCTION>\n";
  messageRatingPrompt: string = "\"<MESSAGE>\"\nOnly respond with a positive number, do not explain, don't use text.\nRate how positive the sentiment of the message was on a scale from 1 to 10";

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
  survived?: boolean = undefined;
  reputation: number = 50;
  streak: number = -1;
  difficulty: number = 1;

  sentiment: Sentiment = new Sentiment();
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/comprehend/command/DetectSentimentCommand/
  comprehendClient: ComprehendClient = new ComprehendClient({ region: "eu-central-1", credentials: { accessKeyId: environment.comprehendAccessKey, secretAccessKey: environment.comprehendSecretKey } });

  constructor(private http: HttpClient) {
  }

  ngOnInit() {
    let messageJsonFilename = "koboldcpp-request"; // By default, use KoboldCPP's request.
    if (environment.responseType === "choices") {
      messageJsonFilename = "openrouter-request";
    }
    this.http.get(`/assets/json/messages/${messageJsonFilename}.json`).subscribe(res => {
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
    this.messagesRemaining = 4 + (this.difficulty * 1);
    this.survived = undefined;
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

  createSentimentRequestMessage() {
    const lastMessages = this.messages.filter(msg => !msg.fromUser).map(msg => msg.text);
    let messageForRequest = "";
    for (const msg of lastMessages) {
      const updatedMessage = messageForRequest + " " + msg;
      if (updatedMessage.length >= 2000) { // TODO Maak instelbaar. 5000 in prod (5000 chars = 50 units = 0.005 dollars)?
        break;
      }
      messageForRequest = updatedMessage;
    }
    console.log("Message for request:", messageForRequest);
    return messageForRequest;
  }

  async determineSentiment(): Promise<sentimentResult> {
    const input: DetectSentimentRequest = {
      Text: this.createSentimentRequestMessage(),
      LanguageCode: "en"
    };
    const command = new DetectSentimentCommand(input);
    const response: DetectSentimentResponse = await this.comprehendClient.send(command);
    console.log("DetectSentimentResponse", response);
    return { sentiment: response.Sentiment, positivityPercentage: response?.SentimentScore?.Positive };
    // await new Promise(f => setTimeout(f, 1500));
    // return { sentiment: "POSITIVE", positivityPercentage: 31 };
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
      return;
    }

    this.canSendMessage = false;
    this.firstMessageInConversation = false;
    if (!continueResponse) {
      this.canContinueTalking = true;
      this.messages.push({ id: this.messages.length + 1, text: formattedMessage, fromUser: true, rating: 0, sentimentResponse: "" });
    }

    const promptToSend = this.currentPrompt + (continueResponse ? this.continuePromptMessage : this.replacePlaceholders(this.responsePromptMessage.replace("<MESSAGE>", formattedMessage)));
    if (!continueResponse || this.canContinueTalking) {
      this.generateJsonMessage.prompt = promptToSend;
      if (environment.responseType === "results") {
        this.getResponseWithResults(promptToSend, continueResponse);
      } else if (environment.responseType === "choices") {
        this.getResponseWithChoices(promptToSend, continueResponse);
      } else {
        this.messages.push({ id: this.messages.length + 1, text: "!!! No valid 'responseType' configured!", fromUser: false, rating: 0, sentimentResponse: "" });
      }
    }
    window.scrollTo(0, document.body.scrollHeight);
  }

  getResponseWithResults(promptToSend: string, continueResponse: boolean) {
    this.http.post('http://localhost:5001/api/v1/generate', this.replacePlaceholders(JSON.stringify(this.generateJsonMessage))).subscribe(data => {
      let response: any = data;
      if (response && response.results) {
        let responseText = response.results[0].text.trim();
        this.processResponse(responseText, promptToSend, continueResponse);

        if (response.results.length > 1) {
          alert("*** More than one response *** " + response);
        }
      } else {
        this.messages.push({ id: this.messages.length + 1, text: "!!! No usable response, please try again!", fromUser: false, rating: 0, sentimentResponse: "" });
      }
    }, error => {
      console.log(error);
      this.messages.push({ id: this.messages.length + 1, text: "!!! Failed to generate message, please try again!", fromUser: false, rating: 0, sentimentResponse: "" });
      this.canSendMessage = true;
    });
  }

  getResponseWithChoices(promptToSend: string, continueResponse: boolean) {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${environment.apiBearerToken}`
    });
    this.http.post('https://openrouter.ai/api/v1/chat/completions', this.replacePlaceholders(JSON.stringify(this.generateJsonMessage)), { headers: headers }).subscribe(data => {
      let response: any = data;
      console.log("*** response", response);
      if (response && response.choices) {
        let responseText = response.choices[0].text.trim();
        this.processResponse(responseText, promptToSend, continueResponse);

        if (response.choices.length > 1) {
          alert("*** More than one choice *** " + response);
        }
      } else {
        this.messages.push({ id: this.messages.length + 1, text: "!!! No usable response, please try again!", fromUser: false, rating: 0, sentimentResponse: "" });
      }
    });
  }

  async processResponse(responseText: string, promptToSend: string, continueResponse: boolean) {
    if (responseText.includes("###")) {
      responseText = responseText.substring(0, responseText.indexOf("###"));
    }
    if (responseText.includes("***")) {
      responseText = responseText.substring(0, responseText.indexOf("***"));
    }
    if (responseText.includes(this.userName + ":")) {
      console.log("!!! ResponseText included <USER>:, removing!", responseText);
      responseText = responseText.substring(0, responseText.indexOf(this.userName + ":"));
    }
    if (responseText.includes("[System Note")) {
      console.log("!!! ResponseText included [System Note:, removing!", responseText);
      responseText = responseText.substring(0, responseText.indexOf("[System Note"));
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

    const sentimentResponse = this.sentiment.analyze(message);
    console.log("*** Sentiment message rating:", sentimentResponse, message.substring(0, 15), "***");

    if (/[.,!?'"`]$/.test(message)) {
      this.canContinueTalking = false;
    }

    if (existingMessage) {
      existingMessage.text = message;
      // existingMessage.rating = messageRating;
      existingMessage.sentimentResponse = existingMessage.sentimentResponse + " > " + sentimentResponse.score + "/" + sentimentResponse.comparative;
      this.rateMessage(existingMessage, existingMessage.rating);
    } else if (message) {
      const messageToAdd = { id: this.messages.length + 1, text: message, fromUser: false, rating: -1, sentimentResponse: sentimentResponse.score + "/" + sentimentResponse.comparative };
      this.messages.push(messageToAdd);
      this.rateMessage(messageToAdd, -1);
    }

    this.canSendMessage = true;
    this.messagesRemaining--;

    if (this.messagesRemaining == 0) {
      this.availableCharacters = this.availableCharacters.filter(character => character !== this.chosenCharacter);
      const sentimentResult = await this.determineSentiment();
      if (sentimentResult.sentiment === 'POSITIVE' || (sentimentResult.positivityPercentage && sentimentResult.positivityPercentage >= 0.3)) {
        this.survived = true;
      } else {
        this.survived = false;
      }
    }

    setTimeout(() => {
      window.scrollTo(0, document.body.scrollHeight);
      this.chatInput.nativeElement.focus();
    }, 5);
  }

  rateMessage(message: message, existingRating: number) {
    // For now, don't rate choices, i.e. when we use OpenRouter (which is an external API).
    if (environment.responseType === "choices") {
      message.rating = -1;
      return;
    }
    this.generateJsonMessage.prompt = this.messageRatingPrompt.replace("<MESSAGE>", message.text);
    this.http.post('http://localhost:5001/api/v1/generate', this.replacePlaceholders(JSON.stringify(this.generateJsonMessage))).subscribe(data => {
      let response: any = data;
      let messageRating = -1;
      if (response && response.results) {
        let responseText = response.results[0].text.trim();
        responseText = responseText.replace(/\D/g, ''); // Remove non-numeric characters
        if (responseText.startsWith('10')) {
          messageRating = 10;
        } else {
          const rating = parseInt(responseText.charAt(0));
          messageRating = isNaN(rating) ? -1 : rating;
        }
      }
      console.log("*** messageRating: ", messageRating);

      console.log("!!! Old reputation: ", this.reputation, "Existing rating: ", existingRating, "New rating: ", messageRating);
      if (existingRating > 0 && messageRating > 0) {
        this.reputation -= this.determineReputationChange(existingRating);
        this.reputation += this.determineReputationChange(messageRating);
      } else if (messageRating > 0) {
        this.reputation += this.determineReputationChange(messageRating);
      }
      console.log("!!! New reputation: ", this.reputation);
      message.rating = messageRating;
    }, error => {
      console.log(error);
      this.messages.push({ id: this.messages.length + 1, text: "!!! Failed to rate message!", fromUser: false, rating: 0, sentimentResponse: "" });
    });
  }

  determineReputationChange(messageRating: number) {
    let reputationChange = 0;
    if (this.reputation > 0 && this.reputation < 100) {
      if (messageRating <= 5 && this.messagesRemaining > 0) {
        reputationChange -= ((5 * this.difficulty) + 1 - messageRating);
      } else if (messageRating == 8) {
        reputationChange += 2;
      } else if (messageRating == 9) {
        reputationChange += 5;
      } else if (messageRating == 10) {
        reputationChange += 10;
      }
    }
    return reputationChange;
  }

  replacePlaceholders(text: string) {
    return text.replaceAll("<TOPIC>", this.currentTopic).replaceAll("<USER>", this.userName).replaceAll("<CHARACTER>", this.characterName);
  }

}

export interface message {
  id: number;
  text: string;
  fromUser: boolean;
  rating: number;
  sentimentResponse: string;
}

export interface sentimentResult {
  sentiment?: string;
  positivityPercentage?: number;
}