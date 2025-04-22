import React, { useState, useEffect, useRef } from 'react';

interface LipSyncProps {
  audioUrl?: string;
  isPlaying: boolean;
  onLipSyncValueChange: (value: number) => void;
  onPlaybackComplete: () => void;
}

const LipSync: React.FC<LipSyncProps> = ({
  audioUrl,
  isPlaying,
  onLipSyncValueChange,
  onPlaybackComplete
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [isAudioLoaded, setIsAudioLoaded] = useState(false);
  
  // Initialize audio context and analyzer
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
    }
    
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);
  
  // Load and play audio when URL changes
  useEffect(() => {
    if (!audioUrl) return;
    
    // Create new audio element
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    
    // Set up event listeners
    audio.addEventListener('canplaythrough', () => {
      setIsAudioLoaded(true);
    });
    
    audio.addEventListener('ended', () => {
      onPlaybackComplete();
      onLipSyncValueChange(0);
    });
    
    // Connect to analyzer
    if (audioContextRef.current && analyserRef.current) {
      const source = audioContextRef.current.createMediaElementSource(audio);
      source.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
    }
    
    // Clean up
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      setIsAudioLoaded(false);
    };
  }, [audioUrl, onPlaybackComplete]);
  
  // Handle play/pause
  useEffect(() => {
    if (!audioRef.current || !isAudioLoaded) return;
    
    if (isPlaying) {
      audioRef.current.play().catch(err => {
        console.error('Error playing audio:', err);
      });
      
      // Start analyzing for lip sync
      analyzeLipSync();
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, isAudioLoaded]);
  
  // Analyze audio for lip sync
  const analyzeLipSync = () => {
    if (!analyserRef.current || !isPlaying) return;
    
    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const updateLipSync = () => {
      if (!analyserRef.current || !isPlaying) return;
      
      // Get frequency data
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume in speech frequency range (500-2000 Hz)
      // This is a simplified approach - a more sophisticated algorithm would
      // focus on specific frequency bands related to speech
      let sum = 0;
      let count = 0;
      
      // Approximate the speech frequency range in the frequency bin array
      const binSize = (audioContextRef.current?.sampleRate || 44100) / analyser.fftSize;
      const startBin = Math.floor(500 / binSize);
      const endBin = Math.floor(2000 / binSize);
      
      for (let i = startBin; i < endBin && i < dataArray.length; i++) {
        sum += dataArray[i];
        count++;
      }
      
      // Calculate average and normalize to 0-1
      const average = count > 0 ? sum / count / 255 : 0;
      
      // Apply some smoothing and amplification for better visual effect
      const lipSyncValue = Math.min(1, average * 1.5);
      onLipSyncValueChange(lipSyncValue);
      
      // Continue analyzing if still playing
      if (isPlaying) {
        requestAnimationFrame(updateLipSync);
      }
    };
    
    // Start the analysis loop
    requestAnimationFrame(updateLipSync);
  };
  
  // For testing without actual audio
  const simulateLipSync = () => {
    if (!isPlaying) return;
    
    let time = 0;
    const interval = 50; // ms
    
    const updateSimulation = () => {
      if (!isPlaying) return;
      
      // Generate a semi-random lip sync value based on time
      // This creates a somewhat natural-looking pattern
      time += interval;
      const base = Math.sin(time * 0.01) * 0.5 + 0.5; // 0-1 sinusoidal wave
      const noise = Math.random() * 0.3; // Random variation
      const lipSyncValue = Math.min(1, Math.max(0, base + noise - 0.2));
      
      onLipSyncValueChange(lipSyncValue);
      
      // Continue simulation if still playing
      if (isPlaying) {
        setTimeout(updateSimulation, interval);
      } else {
        onLipSyncValueChange(0);
      }
    };
    
    // Start the simulation
    updateSimulation();
    
    // Simulate end after a shorter time (1-2 seconds)
    const duration = 1000 + Math.random() * 1000;
    console.log(`LipSync: Simulating speech for ${Math.round(duration/1000)} seconds`);
    
    setTimeout(() => {
      if (isPlaying) {
        console.log('LipSync: Simulation complete, triggering playback complete');
        onPlaybackComplete();
      }
    }, duration);
  };
  
  // If no audio URL is provided, simulate lip sync
  useEffect(() => {
    if (!audioUrl && isPlaying) {
      console.log('No audio URL provided, simulating lip sync');
      simulateLipSync();
      
      // Ensure playback complete is called after a fixed time
      // This is a fallback in case the simulation doesn't trigger it
      const timer = setTimeout(() => {
        console.log('Forced playback complete called after timeout');
        onPlaybackComplete();
      }, 2000); // Maximum 2 seconds
      
      return () => clearTimeout(timer);
    }
  }, [audioUrl, isPlaying, onPlaybackComplete]);
  
  return null; // This is a utility component, no UI needed
};

export default LipSync;
