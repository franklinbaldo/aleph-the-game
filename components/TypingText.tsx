import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Sender } from '../types';

interface TypingTextProps {
  lines: string[];
  sender: Sender | string;
  onComplete?: () => void;
  ttsEnabled?: boolean;
}

const TypingText: React.FC<TypingTextProps> = ({ lines, sender, onComplete, ttsEnabled = false }) => {
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const isSpeakingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visibleLines >= lines.length) {
      onComplete?.();
      return;
    }

    const currentLineIndex = visibleLines;
    const currentLineText = lines[currentLineIndex];

    const next = () => {
      isSpeakingRef.current = false;
      setVisibleLines((prev) => prev + 1);
    };

    if (ttsEnabled && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(currentLineText);
      const voices = window.speechSynthesis.getVoices();
      
      let selectedVoice = voices.find(v => v.name.includes('Google US English')) || 
                          voices.find(v => v.lang.startsWith('en')) || 
                          voices[0];
      
      if (selectedVoice) utterance.voice = selectedVoice;

      const senderUpper = String(sender).toUpperCase();
      if (senderUpper === 'BORGES' || senderUpper === 'PLAYER') {
        utterance.pitch = 0.8;
        utterance.rate = 0.9;
      } else if (senderUpper === 'CARLOS') {
        utterance.pitch = 1.15;
        utterance.rate = 1.2;
      } else if (senderUpper === 'SYSTEM') {
        utterance.pitch = 1.0;
        utterance.rate = 1.0;
        utterance.volume = 0.7;
      }

      utterance.onend = () => {
        next();
      };

      utterance.onerror = (e) => {
        console.warn("TTS Error", e);
        next();
      };

      isSpeakingRef.current = true;
      window.speechSynthesis.speak(utterance);

    } else {
      const delay = currentLineText.startsWith('>') ? 400 : 800;
      timeoutRef.current = setTimeout(next, delay);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (isSpeakingRef.current && ttsEnabled) {
        window.speechSynthesis.cancel();
        isSpeakingRef.current = false;
      }
    };
  }, [visibleLines, lines, sender, onComplete, ttsEnabled]);

  const getSenderStyle = (s: Sender | string) => {
    const sUpper = String(s).toUpperCase();
    switch (sUpper) {
      case Sender.Borges:
      case 'BORGES':
        // Classic greentext style, readable size
        return 'text-green-400 font-mono text-sm sm:text-base leading-relaxed'; 
      case Sender.Carlos:
      case 'CARLOS':
        // Large, yellow, serif, italic - distinct personality
        return 'text-yellow-400 font-serif italic text-lg sm:text-xl leading-loose tracking-wide'; 
      case Sender.System:
      case 'SYSTEM':
        // Distinct red/pink warning style
        return 'text-red-400 font-mono text-xs sm:text-sm uppercase tracking-widest font-bold';
      case Sender.Player:
        return 'text-gray-500 italic font-serif';
      default:
        return 'text-gray-300';
    }
  };

  return (
    <div className="space-y-3 mb-6">
      {lines.slice(0, visibleLines + 1).map((line, index) => (
         index <= visibleLines && index < lines.length && (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className={getSenderStyle(sender)}
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