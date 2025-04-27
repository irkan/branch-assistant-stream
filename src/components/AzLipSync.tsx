import React, { useState, useRef, useEffect, useCallback } from 'react';

interface Phoneme {
  value: string;
  startTime: number;
  endTime: number;
}

type PhonemeData = {
  phonemes: Phoneme[];
};

interface AzLipSyncProps {
  audioUrl: string;
  onPhonemeChange?: (phoneme: string | null) => void;
  isPlaying?: boolean;
  onEnded?: () => void;
  onPlayingChange?: (isPlaying: boolean) => void;
  volume?: number;
  mockPhonemes?: boolean;
}

/**
 * Component that processes audio for Azerbaijani phonemes and lip syncing
 */
export const AzLipSync: React.FC<AzLipSyncProps> = ({
  audioUrl,
  onPhonemeChange,
  isPlaying = false,
  onEnded,
  onPlayingChange,
  volume = 1
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const phonemeDataRef = useRef<PhonemeData | null>(null);
  const rafRef = useRef<number | null>(null);
  const [currentPhoneme, setCurrentPhoneme] = useState<string | null>(null);

  // Setup audio element
  useEffect(() => {
    const audio = new Audio(audioUrl);
    audio.volume = volume;
    audioRef.current = audio;

    audio.onended = () => {
      if (onPlayingChange) onPlayingChange(false);
      if (onEnded) onEnded();
      setCurrentPhoneme(null);
    };

    return () => {
      if (audio) {
        audio.pause();
        audio.src = '';
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [audioUrl, onEnded, onPlayingChange, volume]);

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Handle play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error("Audio play error:", error);
          if (onPlayingChange) onPlayingChange(false);
        });
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, onPlayingChange]);

  // Animation loop to track current phoneme
  useEffect(() => {
    const updatePhoneme = () => {
      const audio = audioRef.current;
      const phonemeData = phonemeDataRef.current;
      
      if (audio && phonemeData && !audio.paused) {
        const currentTime = audio.currentTime;
        
        // Find the current phoneme based on time
        const foundPhoneme = phonemeData.phonemes.find(
          phoneme => currentTime >= phoneme.startTime && currentTime <= phoneme.endTime
        );
        
        const phonemeValue = foundPhoneme?.value || 'X';
        
        // Update state if the phoneme value has changed
        if (phonemeValue !== currentPhoneme) {
          setCurrentPhoneme(phonemeValue);
          if (onPhonemeChange) {
            onPhonemeChange(phonemeValue);
          }
        }
      }
      
      rafRef.current = requestAnimationFrame(updatePhoneme);
    };
    
    rafRef.current = requestAnimationFrame(updatePhoneme);
    
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [onPhonemeChange]);

  // Empty render as this is a non-visual component
  return null;
}; 