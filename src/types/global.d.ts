interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  lang: string;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onend: () => void;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface DisplayMediaStreamConstraints {
  video?: {
    displaySurface?: 'browser' | 'monitor' | 'window';
    logicalSurface?: boolean;
    cursor?: 'always' | 'motion' | 'never';
  };
  audio?: boolean | MediaTrackConstraints;
}

interface MediaDevices {
  getDisplayMedia(constraints?: DisplayMediaStreamConstraints): Promise<MediaStream>;
}

interface Window {
  SpeechRecognition: {
    new(): SpeechRecognition;
  };
  webkitSpeechRecognition: {
    new(): SpeechRecognition;
  };
}