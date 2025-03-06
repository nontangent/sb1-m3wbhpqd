import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { NgIf, NgFor, DatePipe, AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CameraService } from '../../services/camera.service';
import { SpeechService } from '../../services/speech.service';
import { OpenAIService } from '../../services/openai.service';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'app-migration-assistant',
  standalone: true,
  imports: [NgIf, NgFor, DatePipe, FormsModule, AsyncPipe],
  template: `
    <div class="container">
      <div class="api-key-form" *ngIf="!hasApiKey">
        <svg class="character" width="120" height="120" viewBox="0 0 120 120">
          <g class="character-body">
            <circle cx="60" cy="60" r="40" fill="#FFB6C1" />
            <circle class="eye left-eye" cx="45" cy="50" r="5" fill="#333" />
            <circle class="eye right-eye" cx="75" cy="50" r="5" fill="#333" />
            <path class="mouth" d="M50 70 Q60 80 70 70" stroke="#333" fill="none" stroke-width="3" />
          </g>
        </svg>
        <input 
          type="file" 
          accept="image/*" 
          #fileInput 
          (change)="onFileSelected($event)"
          style="display: none"
        >
        <input 
          type="password" 
          [(ngModel)]="apiKey" 
          placeholder="OpenAI APIキーを入力" 
          class="api-key-input"
          (keyup.enter)="setApiKey()"
        >
        <button (click)="setApiKey()" class="api-key-button">設定</button>
      </div>
      <div class="main-content">
        <div class="left-panel">
          <video #videoElement autoplay playsinline></video>
          <div class="phone-overlay">
            <div class="source-phone">移行元端末</div>
            <div class="target-phone">移行先端末</div>
          </div>
          <div class="controls">
            <select 
              [(ngModel)]="selectedDeviceId" 
              [disabled]="cameraActive"
              class="device-select"
            >
              <option value="">背面カメラ（デフォルト）</option>
              <option *ngFor="let device of availableDevices$ | async" [value]="device.deviceId">
                {{ device.label || 'カメラ ' + device.deviceId.slice(0, 5) + '...' }}
              </option>
            </select>
            <button (click)="toggleCamera()">
              {{ cameraActive ? 'カメラを停止' : 'カメラを開始' }}
            </button>
            <button (click)="toggleSpeech()">
              {{ isListening ? '音声認識を停止' : '音声認識を開始' }}
            </button>
            <button (click)="fileInput.nativeElement.click()">
              画像をアップロード
            </button>
          </div>
        </div>

        <div class="right-panel">
          <div class="chat-container">
            <div class="chat-messages">
              <div *ngFor="let message of messages$ | async" class="chat-message" [class.assistant-message]="message.isAssistant">
                <div class="message-header">
                  <div class="message-sender">{{ message.isAssistant ? 'AI アシスタント' : 'ユーザー' }}</div>
                  <svg *ngIf="message.text === '応答を生成中...'" class="thinking-character" width="40" height="40" viewBox="0 0 120 120">
                    <g class="character-body">
                      <circle cx="60" cy="60" r="40" fill="#FFB6C1" />
                      <circle class="eye left-eye" cx="45" cy="50" r="5" fill="#333" />
                      <circle class="eye right-eye" cx="75" cy="50" r="5" fill="#333" />
                      <path class="mouth thinking" d="M50 75 Q60 65 70 75" stroke="#333" fill="none" stroke-width="3" />
                    </g>
                  </svg>
                  <div class="message-time">{{ message.time | date:'HH:mm:ss' }}</div>
                </div>
                <div class="message-content">
                  <img *ngIf="message.screenshot" [src]="message.screenshot" class="message-screenshot" />
                  <div *ngIf="message.text" class="message-text">{{ message.text }}</div>
                </div>
              </div>
            </div>
          <div class="interim-message" *ngIf="isListening && interimResults">
            {{ interimResults }}
          </div>
        </div>
      </div>
      </div>
    </div>
  `,
  styles: [`
    .container {
      padding: 20px;
    }
    
    .device-select {
      padding: 8px;
      border-radius: 4px;
      border: 1px solid #ccc;
      background: white;
      min-width: 200px;
      opacity: 1;
      height: auto;
    }
    
    .device-select:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    .main-content {
      display: flex;
      gap: 20px;
      height: calc(100vh - 100px);
    }
    
    .left-panel {
      position: relative;
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    
    video {
      width: 100%;
      max-height: calc(100vh - 200px);
      object-fit: contain;
      border-radius: 8px;
    }
    
    .phone-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      justify-content: space-around;
      align-items: center;
      pointer-events: none;
    }
    
    .source-phone,
    .target-phone {
      padding: 10px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      border-radius: 4px;
    }
    
    .controls {
      margin: 20px 0;
      display: flex;
      gap: 10px;
      justify-content: center;
    }
    
    button {
      padding: 10px 20px;
      border-radius: 4px;
      border: none;
      background: #007bff;
      color: white;
      cursor: pointer;
    }
    
    button:hover {
      background: #0056b3;
    }
    
    .right-panel {
      width: 400px;
      flex-shrink: 0;
      background: #f8f9fa;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    .chat-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 15px;
    }
    
    .chat-message {
      margin-bottom: 15px;
      background: white;
      padding: 12px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .message-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid #eee;
    }
    
    .message-sender {
      font-weight: 500;
      color: #333;
    }
    
    .message-time {
      font-size: 0.8em;
      color: #666;
    }
    
    .message-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .message-screenshot {
      width: 100%;
      max-width: 360px;
      height: auto;
      border-radius: 4px;
      border: 1px solid #eee;
    }
    
    .assistant-message {
      background: #f8f9ff;
      border-left: 4px solid #007bff;
    }
    
    .message-text {
      line-height: 1.5;
      color: #333;
    }
    
    .interim-message {
      padding: 10px;
      background: rgba(0,0,0,0.05);
      margin: 10px;
      border-radius: 4px;
    }
    
    .api-key-form {
      margin-bottom: 20px;
      display: flex;
      gap: 10px;
      justify-content: center;
    }
    
    .api-key-input {
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      width: 300px;
    }
    
    .api-key-button {
      padding: 10px 20px;
    }
    
    .character {
      margin: 10px;
      animation: bounce 2s infinite;
    }
    
    .thinking-character {
      animation: think 1s infinite;
    }
    
    .character-body {
      transform-origin: center;
    }
    
    .eye {
      animation: blink 3s infinite;
    }
    
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    
    @keyframes think {
      0%, 100% { transform: rotate(-5deg); }
      50% { transform: rotate(5deg); }
    }
    
    @keyframes blink {
      0%, 95%, 100% { transform: scaleY(1); }
      97% { transform: scaleY(0); }
    }
    
  `]
})
export class MigrationAssistantComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  
  cameraActive = false;
  isListening = false;
  selectedDeviceId = '';
  currentTranscript = '';
  interimResults = '';
  availableDevices$ = this.cameraService.availableDevices;
  private messagesSubject = new BehaviorSubject<Array<{
    time: Date;
    screenshot?: string;
    text?: string;
    isAssistant?: boolean;
  }>>([]);
  messages$ = this.messagesSubject.asObservable();
  apiKey = '';
  hasApiKey = false;
  private screenshotInterval: any;

  constructor(
    private cameraService: CameraService,
    protected speechService: SpeechService,
    private openAIService: OpenAIService
  ) {
    // カメラデバイスの一覧を取得
    this.cameraService.getDevices().catch(error => {
      console.error('カメラデバイスの取得に失敗しました:', error);
    });

    this.cameraService.cameraActive.subscribe(
      active => this.cameraActive = active
    );
    
    this.speechService.isListening.subscribe(
      listening => this.isListening = listening
    );
    
    this.speechService.transcript.subscribe(transcript => {
      if (transcript && transcript !== this.currentTranscript) {
        // 音声認識の結果を即座に表示
        this.currentTranscript = transcript;
        const currentMessages = this.messagesSubject.value;
        this.messagesSubject.next([...currentMessages, {
          time: new Date(),
          text: transcript
        }]);
        
        // スクロールを最下部に移動
        this.scrollToBottom();
        
        // AIの応答を取得
        this.analyzeInteraction(transcript);
      }
    });

    this.speechService.interimResults.subscribe(
      results => {
        this.interimResults = results;
        if (results) {
          this.scrollToBottom();
        }
      }
    );
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.cameraService.stopCamera();
    if (this.screenshotInterval) clearInterval(this.screenshotInterval);
    this.speechService.stopListening();
  }

  async toggleCamera(): Promise<void> {
    if (this.cameraActive) {
      this.cameraService.stopCamera();
    } else {
      try {
        await this.cameraService.initializeCamera(this.selectedDeviceId || undefined);
        this.cameraService.attachVideo(this.videoElement.nativeElement);
        // カメラ起動時に定期的なスクリーンショット撮影を開始
        this.screenshotInterval = setInterval(() => {
          const result = this.cameraService.takeScreenshot();
          if (result?.dataUrl && result.hasMotion) {
            // スクリーンショットが有効な場合のみ処理を実行
            const currentMessages = this.messagesSubject.value;
            this.messagesSubject.next([...currentMessages, {
              time: new Date(),
              screenshot: result.dataUrl
            }]);
            
            // Base64文字列からBlobを作成
            const base64Data = result.dataUrl.split(',')[1];
            const blob = this.base64ToBlob(base64Data, 'image/jpeg');
            const file = new File([blob], 'screenshot.jpg', { type: 'image/jpeg' });
            this.analyzeInteraction('この画面の状況を説明してください', file);
          }
        }, 10000); // 10秒ごとにチェック
      } catch (error) {
        console.error('カメラの初期化に失敗しました:', error);
      }
    }
  }

  private base64ToBlob(base64: string, type: string): Blob {
    const binStr = atob(base64);
    const len = binStr.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      arr[i] = binStr.charCodeAt(i);
    }
    return new Blob([arr], { type });
  }

  toggleSpeech(): void {
    if (this.isListening) {
      this.speechService.stopListening();
      if (this.screenshotInterval) {
        clearInterval(this.screenshotInterval);
        this.screenshotInterval = null;
      }
    } else {
      this.speechService.startListening();
    }
  }

  setApiKey(): void {
    if (this.apiKey.trim()) {
      this.openAIService.setApiKey(this.apiKey.trim());
      this.hasApiKey = true;
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const currentMessages = this.messagesSubject.value;
      
      // 画像をメッセージとして表示
      const reader = new FileReader();
      reader.onload = (e) => {
        this.messagesSubject.next([...currentMessages, {
          time: new Date(),
          screenshot: e.target?.result as string
        }]);
        
        // AIに画像を送信して分析
        this.analyzeInteraction('この画像について説明してください', file);
      };
      reader.readAsDataURL(file);
      
      // ファイル選択をリセット
      this.fileInput.nativeElement.value = '';
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const chatMessages = document.querySelector('.chat-messages');
      chatMessages?.scrollTo({
        top: chatMessages.scrollHeight,
        behavior: 'smooth'
      });
    }, 0);
  }

  async analyzeInteraction(text: string, imageFile?: File): Promise<void> {
    if (!this.hasApiKey) return;

    const currentMessages = this.messagesSubject.value;
    const waitingMessageIndex = currentMessages.length;

    try {
      // 応答待ち状態を表示
      this.messagesSubject.next([...currentMessages, {
        time: new Date(),
        text: '応答を生成中...',
        isAssistant: true
      }]);
      
      const response = await this.openAIService.analyzeInteraction(text, imageFile);

      // 応答待ちメッセージを削除
      const updatedMessages = this.messagesSubject.value;
      updatedMessages.splice(waitingMessageIndex, 1);
      
      // AIの応答を表示
      this.messagesSubject.next([...updatedMessages, {
        time: new Date(),
        text: response,
        isAssistant: true
      }]);
      
      // AIの応答を読み上げ
      this.speechService.speak(response);
      
      this.scrollToBottom();
    } catch (error) {
      console.error('OpenAI APIエラー:', error);
      
      // 応答待ちメッセージを削除
      const updatedMessages = this.messagesSubject.value;
      updatedMessages.splice(waitingMessageIndex, 1);
      
      // エラーメッセージを表示
      this.messagesSubject.next([...updatedMessages, {
        time: new Date(),
        text: 'エラーが発生しました。正しいAPIキーを入力してください。',
        isAssistant: true
      }]);
      
      this.scrollToBottom();
    }
  }
}