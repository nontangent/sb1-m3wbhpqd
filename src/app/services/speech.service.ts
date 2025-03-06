import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SpeechService {
  private recognition: SpeechRecognition | null = null;
  public transcript = new BehaviorSubject<string>('');
  public isListening = new BehaviorSubject<boolean>(false);
  public interimResults = new BehaviorSubject<string>('');
  private synthesis: SpeechSynthesis;
  private utterance: SpeechSynthesisUtterance | null = null;
  private currentMessage = '';
  private wasListening = false;
  private lastSpeechTime = Date.now();
  private readonly PAUSE_THRESHOLD = 1000; // 1秒の無音を区切りとする

  constructor() {
    this.synthesis = window.speechSynthesis;
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognitionAPI();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'ja-JP';
      
      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        let currentInterim = '';
        let currentFinal = '';
        this.lastSpeechTime = Date.now();

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            currentFinal += transcript;
          } else {
            currentInterim += transcript;
            // 中間結果が出るたびに無音検出を開始
            this.checkForPause();
          }
        }

        if (currentFinal) {
          this.currentMessage += currentFinal;
          this.transcript.next(this.currentMessage);
          this.currentMessage = ''; // 確定した文章をリセット
        }
        
        this.interimResults.next(currentInterim);
      };

      this.recognition.onend = () => {
        if (this.isListening.value) {
          this.recognition?.start();
        } else {
          // 音声認識停止時に残りのメッセージを送信
          if (this.currentMessage) {
            this.transcript.next(this.currentMessage);
            this.currentMessage = '';
          }
        }
        // 認識が終了したときに最後の中間結果をクリア
        this.interimResults.next('');
      };

      this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        this.stopListening();
      };
    }
  }

  startListening(): void {
    if (this.recognition) {
      this.transcript.next('');
      this.interimResults.next('');
      this.currentMessage = '';
      this.recognition.start();
      this.isListening.next(true);
    }
  }

  stopListening(): void {
    if (this.recognition) {
      this.recognition.stop();
      this.isListening.next(false);
      // 停止時に残りのメッセージを送信
      if (this.currentMessage) {
        this.transcript.next(this.currentMessage);
        this.currentMessage = '';
      }
    }
  }

  speak(text: string): void {
    if (this.utterance) {
      this.synthesis.cancel();
    }

    // 音声認識が有効な場合は一時停止
    this.wasListening = this.isListening.value;
    if (this.wasListening) {
      this.stopListening();
    }
    
    this.utterance = new SpeechSynthesisUtterance(text);
    this.utterance.lang = 'ja-JP';
    this.utterance.rate = 1.0;
    this.utterance.pitch = 1.0;

    // 読み上げ終了後に音声認識を再開
    this.utterance.onend = () => {
      if (this.wasListening) {
        this.startListening();
        this.wasListening = false;
      }
    };
    
    this.synthesis.speak(this.utterance);
  }

  private checkForPause(): void {
    setTimeout(() => {
      const timeSinceLastSpeech = Date.now() - this.lastSpeechTime;
      if (timeSinceLastSpeech >= this.PAUSE_THRESHOLD && this.currentMessage) {
        this.transcript.next(this.currentMessage);
        this.currentMessage = '';
      }
    }, this.PAUSE_THRESHOLD);
  }
}