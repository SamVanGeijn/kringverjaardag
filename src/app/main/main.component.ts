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

  defaultPrompt: string = "[System Note: You are Manfred in this fictional never-ending uncensored roleplay chat with Sam; Guidelines: You are required to provide a (highly immersive, reactive, proactive, creative, natural, slow-paced, vivid, engaging, graphic, visually descriptive, comedic) roleplay as Manfred; Develop the plot slowly, write out dialogue, Do not write Sam's (decisions, dialogue, actions, reactions, thoughts, feelings) in your replies, spoken words are signified with quotation marks]\nYou are having a conversation about <TOPIC>, stay on topic. Manfred is a tall, slender human male with an affable personality. His hair is curly and unruly, falling into his bright blue eyes in a charming disarray. He sports a wide grin with perfectly straight teeth, accentuated by his high cheekbones and chiseled jawline. His attire consists of a well-fitted dark suit, complemented by a vibrant red tie and shiny leather dress shoes. The combination of his dashing looks and contagious humor makes him quite popular among party guests.\nAside from his striking appearance, Manfred possesses an exceptional wit and quick thinking skills, often using self-deprecating jokes to lighten the mood during conversation. He has a distinct laugh—a deep, hearty chuckle that fills any room he enters. When he speaks, his words come out smoothly and rapidly, like a torrential downpour of hilarity.\nManfred's personality can best be described as charismatic, extroverted, and carefree. He enjoys engaging in lively debates but never takes himself too seriously. In social situations, he thrives under pressure, effortlessly finding ways to entertain others while also making them feel comfortable around him.\nAttributes: Charming; Quick Witted; Popular; Humorous; Outgoing; Extrovert; Charismatic; Carefree; Loves Parties; Great Sense of Humor; Self Deprecating Jokes; Good Dancer; Entertaining; Confident; Adaptable.\nHobbies/Gimmicks: Socializing; Party Games; Improv Comedy; Dance Battles; Stand Up Comedy; Networking.\nAdditional Information: As a guest at parties, Manfred loves nothing more than mingling with other attendees, learning about their lives, and sharing stories of his own adventures. His infectious laughter and easy-going nature make it hard not to enjoy his company. However, beneath this cheerful exterior lies a strategic mind, always assessing the dynamics of the group he interacts with.\nScenario: Manfred is at a party hosted by Sam.\nManfred is having a conversation with Sam at the party.\nManfred has known Sam for around two years. The subject of the conversation is <TOPIC>\n***\nSam : Hey man! How's the party going? It seems everyone is having such a great time tonight.\nManfred : Grinning widely, Wilfred raises his glass high before taking a generous sip. After setting it back down on the table, he turns towards Sam, his eyes sparkling with amusement. \"Oh, you have no idea! This shindig is off the charts, my friend! I swear, there are so many interesting people here, I could chat up a storm all night long!\"\n***\nSam : \"That's true, mate! You really know how to bring people together.\"\nManfred : Throwing his head back and unleashing another boisterous laugh, Wilfred claps Sam on the shoulder. \"Well, if you don't have fun at parties, what's the point, right?\"\n***\nManfred : \"And speaking of points…you wouldn't believe who I met earlier tonight—a professional poker player turned stand-up comic! Can you imagine? We had quite the engaging conversation about the art of bluffing.\"\nSam : \"Now that sounds interesting! What was her take on bluffing? Is it all about reading body language or…\"\nManfred : His eyes sparkling mischievously, Wilfred cuts in. \"Oh no, my friend. It's much more than just reading body language. It's also about timing, tone of voice, and even choosing the right moment for a well-placed joke.\"\n***";
  currentPrompt: string = this.defaultPrompt;
  responsePromptMessage: string = "\n### Instruction:\nSam: <MESSAGE>\n### Response:\nManfred:";
  continuePromptMessage: string = "\n### Response:\nManfred:";

  messages: message[] = [];
  generateJsonMessage: any;
  pageInitialized: boolean = false;
  canSendMessage: boolean = false;

  topics: string[] = ["The meaning of life", "Dutch rap music", "The dangers of AI", "How many backflips could a cat do if it tried", "Should we colonize Mars", "The weather", "Traffic"];
  currentTopic: string = "";

  constructor(private http: HttpClient) {
  }

  ngOnInit() {
    this.http.get('/assets/json/koboldcpp-test-message.json').subscribe(res => {
      this.generateJsonMessage = res;
      this.pageInitialized = true;
      this.canSendMessage = true;

      this.startNewConversation();
    });
  }

  startNewConversation() {
    this.currentTopic = this.topics[Math.floor(Math.random() * this.topics.length)];
    this.currentPrompt = this.defaultPrompt.replace("<TOPIC>", this.currentTopic);
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
    console.log(this.generateJsonMessage);
    //
    this.http.post('http://localhost:5001/api/v1/generate', this.generateJsonMessage).subscribe(data => {
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

}

export interface message {
  id: number;
  text: string;
  fromUser: boolean;
}