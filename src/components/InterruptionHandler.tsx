import React, { useState, useEffect, useRef } from 'react';

interface InterruptionHandlerProps {
  isSpeaking: boolean;
  onInterrupt: () => void;
  children: React.ReactNode;
}

const InterruptionHandler: React.FC<InterruptionHandlerProps> = ({
  isSpeaking,
  onInterrupt,
  children
}) => {
  const [isListening, setIsListening] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  
  // Threshold for detecting interruption
  const VOLUME_THRESHOLD = 0.2;
  const CONSECUTIVE_FRAMES_THRESHOLD = 5;
  
  // Counter for consecutive frames above threshold
  const consecutiveFramesRef = useRef(0);
  
  // Initialize audio context and analyzer
  useEffect(() => {
    if (isSpeaking) {
      startListeningForInterruption();
      return () => stopListeningForInterruption();
    } else {
      stopListeningForInterruption();
    }
  }, [isSpeaking]);
  
  const startListeningForInterruption = async () => {
    try {
      // Create audio context if not exists
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneStreamRef.current = stream;
      
      // Create analyzer
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      // Connect microphone to analyzer
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyser);
      
      // Start monitoring volume
      setIsListening(true);
      monitorVolume();
    } catch (error) {
      console.error('Error accessing microphone for interruption detection:', error);
    }
  };
  
  const stopListeningForInterruption = () => {
    // Stop microphone stream
    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach(track => track.stop());
      microphoneStreamRef.current = null;
    }
    
    setIsListening(false);
    consecutiveFramesRef.current = 0;
  };
  
  const monitorVolume = () => {
    if (!isListening || !analyserRef.current) return;
    
    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const checkVolume = () => {
      if (!isListening || !analyserRef.current) return;
      
      // Get volume data
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume (0-255)
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      
      // Normalize to 0-1
      const normalizedVolume = average / 255;
      
      // Check if volume is above threshold
      if (normalizedVolume > VOLUME_THRESHOLD) {
        consecutiveFramesRef.current++;
        
        // If volume is above threshold for consecutive frames, trigger interruption
        if (consecutiveFramesRef.current >= CONSECUTIVE_FRAMES_THRESHOLD) {
          console.log('Interruption detected!');
          onInterrupt();
          stopListeningForInterruption();
          return;
        }
      } else {
        // Reset counter if volume drops below threshold
        consecutiveFramesRef.current = 0;
      }
      
      // Continue monitoring if still listening
      if (isListening) {
        requestAnimationFrame(checkVolume);
      }
    };
    
    // Start checking volume
    requestAnimationFrame(checkVolume);
  };
  
  return <>{children}</>;
};

export default InterruptionHandler;
