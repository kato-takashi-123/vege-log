import { useState, useEffect, useRef } from 'react';

export const useVoiceRecognition = ({ onResult }: { onResult: (text: string) => void }) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
      setIsListening(false);
    };
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error, event.message);
      let errorMessage = '音声認識中に不明なエラーが発生しました。';
      switch(event.error) {
          case 'network':
              errorMessage = '音声認識に失敗しました。ネットワーク接続を確認して、もう一度お試しください。';
              break;
          case 'no-speech':
              errorMessage = '音声が検出されませんでした。はっきりと話してみてください。';
              break;
          case 'audio-capture':
              errorMessage = 'マイクを認識できません。マイクのアクセス許可を確認してください。';
              break;
          case 'not-allowed':
              errorMessage = 'マイクの使用が許可されていません。ブラウザの設定でこのサイトのマイクアクセスを許可してください。';
              break;
      }
      alert(errorMessage);
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognitionRef.current = recognition;
  }, [onResult]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error("Could not start recognition", err);
      }
    }
  };

  return { isListening, startListening };
};
