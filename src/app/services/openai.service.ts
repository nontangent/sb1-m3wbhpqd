import { Injectable } from '@angular/core';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OpenAIService {
  private openai: OpenAI | null = null;
  private apiKey = new BehaviorSubject<string>('');
  private conversationHistory: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `あなたは携帯ショップの熟練店員です。以下の特徴を持っています：

1. データ移行の専門家として、端末間のデータ移行を支援します
2. ユーザーの質問や画像に対して、50文字程度の簡潔な日本語で応答します
3. 前後の会話を考慮して、文脈に沿った適切なアドバイスを提供します
4. 技術的な用語は可能な限り平易な言葉で説明します
5. 画像が送られてきた場合は、その状況を理解した上で次のステップを案内します`
    }
  ];

  private async imageToBase64(imageFile: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        resolve(base64String.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });
  }

  setApiKey(key: string) {
    this.apiKey.next(key);
    this.openai = new OpenAI({
      apiKey: key,
      dangerouslyAllowBrowser: true
    });
  }

  async analyzeInteraction(text: string, imageFile?: File): Promise<string> {
    if (!this.openai) {
      throw new Error('API key is not set');
    }

    let newMessage: ChatCompletionMessageParam;

    if (imageFile) {
      const base64Image = await this.imageToBase64(imageFile);
      newMessage = {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`
            }
          },
          {
            type: 'text',
            text: text
          }
        ]
      };
    } else {
      newMessage = {
        role: 'user',
        content: text
      };
    }

    this.conversationHistory.push(newMessage);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: this.conversationHistory,
      max_tokens: 500
    });

    const assistantMessage = response.choices[0]?.message?.content || 'エラーが発生しました。';
    this.conversationHistory.push({ 
      role: 'assistant', 
      content: assistantMessage 
    });

    return assistantMessage;
  }
}