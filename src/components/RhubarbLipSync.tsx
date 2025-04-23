import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface RhubarbLipSyncProps {
  audioUrl?: string;
  isPlaying: boolean;
  onPhonemeChange?: (phoneme: string) => void;
  onPlaybackComplete?: () => void;
}

interface PhonemeData {
  start: number;
  end: number;
  value: string;
}

const RhubarbLipSync: React.FC<RhubarbLipSyncProps> = ({
  audioUrl,
  isPlaying,
  onPhonemeChange,
  onPlaybackComplete
}) => {
  const [phonemeData, setPhonemeData] = useState<PhonemeData[]>([]);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Process audio with Rhubarb
  useEffect(() => {
    if (!audioUrl) return;
    
    const processAudio = async () => {
      try {
        setIsProcessing(true);
        console.log('Processing audio with Rhubarb:', audioUrl);
        
        // This assumes you have a server endpoint that processes audio with Rhubarb
        // You would need to implement this server-side
        const response = await axios.post('/api/rhubarb-process', { audioUrl });
        const data = response.data;
        
        if (data.phonemes) {
          setPhonemeData(data.phonemes);
          console.log('Phoneme timing data received:', data.phonemes);
        }
      } catch (error) {
        console.error('Error processing audio with Rhubarb:', error);
        // Fallback to mock data for testing
        const mockPhonemes = generateMockPhonemes();
        setPhonemeData(mockPhonemes);
        console.log('Using mock phoneme data:', mockPhonemes);
      } finally {
        setIsProcessing(false);
      }
    };
    
    processAudio();
  }, [audioUrl]);
  
  // Initialize audio element
  useEffect(() => {
    if (!audioUrl) return;
    
    const audio = new Audio(audioUrl);
    setAudioElement(audio);
    
    audio.addEventListener('ended', () => {
      if (onPlaybackComplete) onPlaybackComplete();
    });
    
    return () => {
      audio.pause();
      audio.src = '';
      setAudioElement(null);
    };
  }, [audioUrl, onPlaybackComplete]);
  
  // Play/pause audio and track phonemes
  useEffect(() => {
    if (!audioElement || phonemeData.length === 0) return;
    
    let phonemeTimer: number[] = [];
    
    if (isPlaying) {
      audioElement.currentTime = 0;
      audioElement.play().catch(err => console.error('Error playing audio:', err));
      
      // Schedule phoneme changes based on timing data
      phonemeData.forEach((phoneme, index) => {
        const timerId = window.setTimeout(() => {
          console.log(`Time: ${phoneme.start}s to ${phoneme.end}s, Phoneme: ${phoneme.value}`);
          if (onPhonemeChange) onPhonemeChange(phoneme.value);
        }, phoneme.start * 1000);
        
        phonemeTimer.push(timerId);
      });
    } else {
      audioElement.pause();
      // Clear all timers
      phonemeTimer.forEach(id => clearTimeout(id));
      phonemeTimer = [];
    }
    
    return () => {
      phonemeTimer.forEach(id => clearTimeout(id));
    };
  }, [isPlaying, phonemeData, audioElement, onPhonemeChange]);
  
  // Generate mock phoneme data for testing
  const generateMockPhonemes = (): PhonemeData[] => {
    // Rhubarb standart phoneme dəyərləri
    const phonemeSequences = [
      // Salam! Mən burada...
      ["X", "B", "A", "G", "A", "C", "X", "C", "E", "B", "C"],
      // Nə ilə kömək edə bilərəm?
      ["X", "C", "E", "X", "B", "G", "E", "X", "H", "D", "C", "E"]
    ];
    
    // Təsadüfi bir cümlə seçək
    const selectedSequence = phonemeSequences[Math.floor(Math.random() * phonemeSequences.length)];
    const mockData: PhonemeData[] = [];
    
    let currentTime = 0;
    // Seçilmiş ardıcıllığı zamanlama ilə əlavə edək
    for (let i = 0; i < selectedSequence.length; i++) {
      const phoneme = selectedSequence[i];
      const duration = phoneme === "X" ? 0.1 + Math.random() * 0.1 : 0.15 + Math.random() * 0.15;
      
      mockData.push({
        start: currentTime,
        end: currentTime + duration,
        value: phoneme
      });
      
      currentTime += duration;
    }
    
    return mockData;
  };
  
  return (
    <div style={{ display: 'none' }}>
      {isProcessing && <p>Processing audio with Rhubarb...</p>}
    </div>
  );
};

export default RhubarbLipSync; 