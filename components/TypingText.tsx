import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Sender } from '../types';
import { generateSpeech } from '../services/geminiService';
import { Play, Square, Loader2 } from 'lucide-react';

interface TypingTextProps {
  lines: string[];
  sender: Sender | string;
  tone?: string;
  onComplete?: () => void;
  autoPlay?: boolean;
}

// Helper to decode base64 string to byte array
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to decode raw PCM data to AudioBuffer
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const TypingText: React.FC<TypingTextProps> = ({ lines, sender, tone, onComplete, autoPlay = false }) => {
  const [visibleLines, setVisibleLines] = useState<number>(0);
  
  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const isMountedRef = useRef(true);
  const shouldStopRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    // Initialize AudioContext on mount
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
    }

    // If Auto-play is enabled, start playing immediately
    if (autoPlay) {
      startPlayback();
    }

    return () => {
      isMountedRef.current = false;
      stopPlayback();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Text Reveal Animation Effect
  useEffect(() => {
    if (visibleLines < lines.length) {
      // Standard typing logic
      const delay = lines[visibleLines].startsWith('>') ? 300 : 500;
      const timer = setTimeout(() => {
        setVisibleLines(prev => prev + 1);
      }, delay);
      return () => clearTimeout(timer);
    } else {
      onComplete?.();
    }
  }, [visibleLines, lines, onComplete]);

  const stopPlayback = () => {
    shouldStopRef.current = true;
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch(e) {}
    }
    setIsPlaying(false);
    setIsLoadingAudio(false);
  };

  const startPlayback = async () => {
    if (isPlaying) return; // Prevent double start
    
    setIsPlaying(true);
    shouldStopRef.current = false;

    // Ensure audio context is running
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    try {
      setIsLoadingAudio(true);
      
      // Join all lines to send as a single request for smoother audio
      const fullText = lines.join(' ');
      
      // If we are starting playback, ensure all text is visible so user can read along
      setVisibleLines(lines.length);

      const base64Audio = await generateSpeech(fullText, sender, tone);
      setIsLoadingAudio(false);

      if (shouldStopRef.current || !isMountedRef.current) return;

      if (!base64Audio) {
        // Skip if generation failed
        stopPlayback();
        return;
      }

      const ctx = audioContextRef.current;
      if (!ctx) return;

      const audioBytes = decode(base64Audio);
      const audioBuffer = await decodeAudioData(audioBytes, ctx, 24000, 1);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      source.onended = () => {
        if (shouldStopRef.current) return;
        stopPlayback();
      };

      currentSourceRef.current = source;
      source.start(0);

    } catch (err) {
      console.error("Playback error", err);
      stopPlayback();
    }
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  };

  const getSenderStyle = (s: Sender | string) => {
    const sUpper = String(s).toUpperCase();
    switch (sUpper) {
      case Sender.Borges:
      case 'BORGES':
        return 'text-green-400 font-mono text-sm sm:text-base leading-snug'; 
      case Sender.Carlos:
      case 'CARLOS':
        return 'text-yellow-400 font-serif italic text-lg sm:text-xl leading-loose tracking-wide'; 
      case Sender.System:
      case 'SYSTEM':
        return 'text-red-400 font-mono text-xs sm:text-sm uppercase tracking-widest font-bold';
      case Sender.Player:
        return 'text-gray-500 italic font-serif';
      default:
        return 'text-gray-300';
    }
  };

  return (
    <div className="relative group space-y-1 mb-4">
      
      {/* Audio Control Button (Visible on hover or when playing) */}
      <div className={`absolute -right-8 top-0 transition-opacity duration-300 ${isPlaying || visibleLines === lines.length ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <button 
          onClick={handleTogglePlay}
          disabled={isLoadingAudio && isPlaying}
          className={`
            p-2 rounded-full border bg-black/50 backdrop-blur-sm transition-all
            ${isPlaying 
              ? 'border-green-500 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]' 
              : 'border-gray-800 text-gray-600 hover:text-green-500 hover:border-green-500/50'}
          `}
          title={isPlaying ? "Stop Narration" : "Play Narration"}
        >
          {isLoadingAudio ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : isPlaying ? (
            <Square className="w-3 h-3 fill-current" />
          ) : (
            <Play className="w-3 h-3 fill-current" />
          )}
        </button>
      </div>

      {lines.slice(0, visibleLines + 1).map((line, index) => (
         index <= visibleLines && index < lines.length && (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className={`
              ${getSenderStyle(sender)}
              transition-all duration-300
              ${isPlaying ? 'opacity-100 drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]' : 'opacity-90'}
            `}
          >
            {line.startsWith('>') ? (
              <span>
                <span className="opacity-40 mr-2 select-none">{'>'}</span>
                {line.substring(1)}
              </span>
            ) : (
              line
            )}
          </motion.div>
        )
      ))}
    </div>
  );
};

export default TypingText;