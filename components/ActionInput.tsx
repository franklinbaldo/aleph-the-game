import React, { useState, useEffect } from 'react';
import { Mic, Send, MicOff, Activity } from 'lucide-react';

// --- Types for Web Speech API ---
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

interface SpeechRecognitionStatic {
  new (): SpeechRecognition;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
  interpretation: any;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionStatic;
    webkitSpeechRecognition: SpeechRecognitionStatic;
  }
}
// --- End Types ---

interface ActionInputProps {
  onSubmit: (text: string) => void;
  disabled: boolean;
  isThinking: boolean;
}

const ActionInput: React.FC<ActionInputProps> = ({ onSubmit, disabled, isThinking }) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = false;
        recognitionInstance.interimResults = false;
        recognitionInstance.lang = 'en-US';

        recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[0][0].transcript;
          setInput(transcript); // Overwrite input with speech result
          setIsListening(false);
        };

        recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error', event.error);
          setIsListening(false);
        };

        recognitionInstance.onend = () => {
          setIsListening(false);
        };

        setRecognition(recognitionInstance);
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      recognition.start();
      setIsListening(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled && !isThinking) {
      onSubmit(input.trim());
      setInput('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full mb-4 relative z-50 flex gap-3 items-stretch">
      <div className="relative flex-grow group">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled || isThinking}
          placeholder={isListening ? "Listening..." : (isThinking ? "Fate is being written..." : "Write your action...")}
          className={`
            w-full h-full bg-black/40 border-b border-gray-700 
            text-gray-200 font-mono text-sm py-3 px-3
            focus:outline-none focus:border-green-500/50 focus:bg-black/60
            transition-all duration-300 rounded-t
            disabled:opacity-50 disabled:cursor-not-allowed
            placeholder:text-gray-600 placeholder:italic
            ${isListening ? 'border-red-500/50 text-red-200' : ''}
          `}
        />
        <div className={`absolute bottom-0 left-0 h-px w-0 group-focus-within:w-full transition-all duration-700 ease-out ${isListening ? 'bg-red-500 w-full animate-pulse' : 'bg-green-500/50'}`} />
      </div>
      
      {recognition && (
        <button
          type="button"
          onClick={toggleListening}
          disabled={disabled || isThinking}
          className={`
            flex-shrink-0 w-12 flex items-center justify-center
            rounded border transition-all duration-300
            ${isListening 
              ? 'bg-red-900/20 border-red-500 text-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.3)]' 
              : 'bg-gray-900/40 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200 hover:bg-gray-800'}
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          title="Record Voice Action"
        >
          {isListening ? <Activity className="w-5 h-5 animate-bounce" /> : <Mic className="w-5 h-5" />}
        </button>
      )}
      
      <button
        type="submit"
        disabled={!input.trim() || disabled || isThinking}
        className={`
          flex-shrink-0 w-12 flex items-center justify-center
          rounded border transition-all duration-300
          ${input.trim() && !disabled && !isThinking
            ? 'bg-green-900/20 border-green-500 text-green-500 hover:bg-green-900/40 shadow-[0_0_10px_rgba(34,197,94,0.2)]'
            : 'bg-gray-900/40 border-gray-800 text-gray-700 cursor-not-allowed'}
        `}
      >
        <Send className="w-5 h-5" />
      </button>
    </form>
  );
};

export default ActionInput;