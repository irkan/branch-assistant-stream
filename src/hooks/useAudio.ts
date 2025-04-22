import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAudioReturn {
  playAudio: (text: string) => Promise<void>;
  stopAudio: () => void;
  lipSyncValue: number;
}

export const useAudio = (): UseAudioReturn => {
  const [lipSyncValue, setLipSyncValue] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Create an audio context once
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Clean up function for the audio context and animation frame
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    
    setLipSyncValue(0);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [cleanup]);

  // Play audio from a text using text-to-speech
  const playAudio = useCallback(async (text: string): Promise<void> => {
    try {
      cleanup();
      
      // Create a new audio element
      const audio = new Audio();
      audioRef.current = audio;
      
      // Simulate TTS - in a real app, you would call your API here
      // For now, we're just creating a dummy URL
      await new Promise<void>((resolve) => {
        // Simulate time to download/generate audio
        setTimeout(() => {
          resolve();
        }, 500);
      });
      
      // Initialize the audio context if it doesn't exist
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      // Set up audio analysis for lip sync
      const audioContext = audioContextRef.current;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      // Connect audio element to the analyser
      const source = audioContext.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      
      // Start analyzing the audio for lip sync
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const analyzeAudio = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average volume in the vocal frequency range (approximately 200-3000 Hz)
        let sum = 0;
        const vocalRangeStart = Math.floor(200 * analyser.frequencyBinCount / audioContext.sampleRate);
        const vocalRangeEnd = Math.ceil(3000 * analyser.frequencyBinCount / audioContext.sampleRate);
        
        for (let i = vocalRangeStart; i < Math.min(vocalRangeEnd, dataArray.length); i++) {
          sum += dataArray[i];
        }
        
        const average = sum / (vocalRangeEnd - vocalRangeStart);
        
        // Map average volume to lip sync value (0-1 range)
        const normalizedValue = Math.min(average / 128, 1);
        setLipSyncValue(normalizedValue);
        
        // Continue analyzing
        animationFrameRef.current = requestAnimationFrame(analyzeAudio);
      };
      
      // Set up audio events
      audio.onplay = () => {
        analyzeAudio();
      };
      
      audio.onended = () => {
        cleanup();
      };
      
      audio.onerror = (e) => {
        console.error('Audio error:', e);
        cleanup();
      };
      
      // Mock audio playback - in a real app you would use a TTS service or have audio files
      const mockAudioPlayback = () => {
        let time = 0;
        const duration = text.length * 80; // Approximation: 80ms per character
        
        const simulateLipSync = () => {
          time += 16; // ~60fps
          
          if (time >= duration) {
            cleanup();
            audio.dispatchEvent(new Event('ended'));
            return;
          }
          
          // Create a simple sine wave pattern for lip sync
          const normalizedTime = time / duration;
          const lipValue = 0.3 + 0.5 * Math.sin(normalizedTime * Math.PI * 20);
          setLipSyncValue(lipValue);
          
          animationFrameRef.current = requestAnimationFrame(simulateLipSync);
        };
        
        animationFrameRef.current = requestAnimationFrame(simulateLipSync);
      };
      
      // Start mock playback
      mockAudioPlayback();
      
      // If using real audio, you would uncomment this line:
      // audio.play();
      
      return new Promise((resolve) => {
        audio.onended = () => {
          cleanup();
          resolve();
        };
      });
    } catch (error) {
      console.error('Error playing audio:', error);
      cleanup();
      throw error;
    }
  }, [cleanup]);

  // Stop audio playback
  const stopAudio = useCallback(() => {
    cleanup();
  }, [cleanup]);

  return {
    playAudio,
    stopAudio,
    lipSyncValue
  };
};

export default useAudio; 