import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

interface PixelData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

@Injectable({
  providedIn: 'root'
})
export class CameraService {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private devices: MediaDeviceInfo[] = [];
  public cameraActive = new BehaviorSubject<boolean>(false);
  public availableDevices = new BehaviorSubject<MediaDeviceInfo[]>([]);
  public screenshot = new Subject<string>();
  private lastFrame: PixelData | null = null;
  private readonly MOTION_THRESHOLD = 30; // 変化を検出する閾値（0-255）
  private readonly CHANGED_PIXELS_THRESHOLD = 0.1; // 全ピクセルの何割の変化で検知とするか（0-1）

  async getDevices(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.devices = devices.filter(device => device.kind === 'videoinput');
      this.availableDevices.next(this.devices);
    } catch (error) {
      console.error('Failed to get camera devices:', error);
      throw error;
    }
  }

  async initializeCamera(deviceId?: string): Promise<void> {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          facingMode: deviceId ? undefined : 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          aspectRatio: { ideal: 16/9 }
        }
      };
      
      // タブ間でカメラを共有するためにgetDisplayMediaを使用
      if (deviceId) {
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      } else {
        try {
          this.stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              displaySurface: 'browser',
              logicalSurface: true,
              cursor: 'never'
            }
          });
        } catch (displayError) {
          console.log('画面共有が拒否されました。通常のカメラモードに切り替えます。');
          this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        }
      }
      
      this.cameraActive.next(true);
    } catch (error) {
      console.error('Camera initialization failed:', error);
      throw error;
    }
  }

  attachVideo(video: HTMLVideoElement): void {
    this.videoElement = video;
    if (this.stream) {
      this.videoElement.onloadedmetadata = () => {
        if (this.videoElement) {
          this.videoElement.play();
        }
      };
      this.videoElement.srcObject = this.stream;
    }
  }

  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
      if (this.videoElement) {
        this.videoElement.srcObject = null;
      }
      this.cameraActive.next(false);
    }
  }

  takeScreenshot(): { dataUrl: string | null; hasMotion: boolean } {
    if (!this.videoElement) return { dataUrl: null, hasMotion: false };
    if (!this.videoElement.videoWidth) return { dataUrl: null, hasMotion: false };
    
    const canvas = document.createElement('canvas');
    canvas.width = this.videoElement.videoWidth;
    canvas.height = this.videoElement.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return { dataUrl: null, hasMotion: false };
    
    ctx.drawImage(this.videoElement, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg');
    
    // 現在のフレームのピクセルデータを取得
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const currentFrame: PixelData = {
      data: imageData.data,
      width: canvas.width,
      height: canvas.height
    };
    
    // モーション検出
    const hasMotion = this.detectMotion(currentFrame);
    
    // 現在のフレームを保存
    this.lastFrame = currentFrame;
    
    if (hasMotion) {
      this.screenshot.next(dataUrl);
    }
    
    return { dataUrl, hasMotion };
  }

  private detectMotion(currentFrame: PixelData): boolean {
    if (!this.lastFrame) {
      return true; // 最初のフレームは常に変化ありとする
    }

    const { data: current, width, height } = currentFrame;
    const { data: last } = this.lastFrame;
    
    let changedPixels = 0;
    const totalPixels = width * height;

    // RGBの値のみを比較（アルファ値は無視）
    for (let i = 0; i < current.length; i += 4) {
      const diffR = Math.abs(current[i] - last[i]);
      const diffG = Math.abs(current[i + 1] - last[i + 1]);
      const diffB = Math.abs(current[i + 2] - last[i + 2]);
      
      // RGB値の差分の平均が閾値を超えているかチェック
      if ((diffR + diffG + diffB) / 3 > this.MOTION_THRESHOLD) {
        changedPixels++;
      }
    }

    // 変化したピクセルの割合が閾値を超えているかチェック
    return (changedPixels / totalPixels) > this.CHANGED_PIXELS_THRESHOLD;
  }
}