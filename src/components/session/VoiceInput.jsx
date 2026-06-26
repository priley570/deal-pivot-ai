import { useState, useRef } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function VoiceInput({ onTranscript, disabled }) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recognitionRef = useRef(null);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. Please use Chrome or Safari.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interimText = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += t;
        else interimText += t;
      }
      setInterim(interimText);
      if (finalText) {
        setInterim('');
        setListening(false);
        onTranscript(finalText.trim());
      }
    };
    recognition.onerror = () => { setListening(false); setInterim(''); };
    recognition.onend = () => { setListening(false); setInterim(''); };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
    setInterim('');
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {interim && (
        <div className="text-xs text-muted-foreground italic px-3 py-1 bg-muted rounded-full max-w-xs text-center truncate">
          "{interim}..."
        </div>
      )}
      <button
        onClick={listening ? stopListening : startListening}
        disabled={disabled}
        className={cn(
          'w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg',
          listening
            ? 'bg-destructive shadow-destructive/30 animate-pulse'
            : disabled
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : 'bg-primary shadow-primary/30 hover:scale-105 active:scale-95'
        )}
      >
        {listening ? (
          <Square className="w-5 h-5 text-white fill-white" />
        ) : (
          <Mic className="w-5 h-5 text-white" />
        )}
      </button>
      <p className="text-[10px] text-muted-foreground">
        {listening ? 'Tap to stop' : 'Tap to speak'}
      </p>
    </div>
  );
}