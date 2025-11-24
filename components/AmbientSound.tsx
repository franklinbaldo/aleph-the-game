
import React, { useEffect, useRef, useState } from 'react';
import { Music, VolumeX } from 'lucide-react';

interface AmbientSoundProps {
  musicUrl?: string; // Base64 audio string
  enabled: boolean;
  volume?: number;
}

// Helper to decode base64 to byte array
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

const AmbientSound: React.FC<AmbientSoundProps> = ({ musicUrl, enabled, volume = 0.3 }) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const currentUrlRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Initialize Context
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
      gainNodeRef.current.gain.value = volume;
    }

    return () => {
      stopAudio();
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
      }
    };
  }, []);

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(enabled ? volume : 0, audioContextRef.current?.currentTime || 0, 0.5);
    }
  }, [volume, enabled]);

  useEffect(() => {
    // Only update if URL changed and exists
    if (musicUrl && musicUrl !== currentUrlRef.current && enabled) {
      currentUrlRef.current = musicUrl;
      playAudio(musicUrl);
    } else if (!enabled) {
      stopAudio();
    }
  }, [musicUrl, enabled]);

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (e) { /* ignore */ }
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  };

  const playAudio = async (base64Audio: string) => {
    if (!audioContextRef.current || !gainNodeRef.current) return;

    try {
      // If something is playing, crossfade out? For now, just stop and start new.
      stopAudio();

      const audioBytes = decode(base64Audio);
      const audioBuffer = await audioContextRef.current.decodeAudioData(audioBytes.buffer.slice(0)); // slice to copy if needed

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true; // Loop the ambient sound
      source.connect(gainNodeRef.current);
      
      source.start(0);
      sourceNodeRef.current = source;
      setIsPlaying(true);
      
    } catch (e) {
      console.error("Error playing ambient sound:", e);
    }
  };

  if (!enabled && !isPlaying) return null;

  return (
    <div className={`fixed bottom-20 left-4 z-30 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}>
       <div className="flex items-center gap-2 px-2 py-1 bg-black/40 border border-gray-800 rounded-full">
          <Music className={`w-3 h-3 ${isPlaying ? 'text-green-500 animate-pulse' : 'text-gray-600'}`} />
          <div className="flex gap-1 h-2 items-end">
             <div className="w-0.5 bg-green-900 h-1 animate-[bounce_1s_infinite]" />
             <div className="w-0.5 bg-green-900 h-2 animate-[bounce_1.2s_infinite]" />
             <div className="w-0.5 bg-green-900 h-1.5 animate-[bounce_0.8s_infinite]" />
          </div>
       </div>
    </div>
  );
};

export default AmbientSound;
