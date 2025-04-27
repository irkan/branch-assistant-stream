import React, { useState, useEffect, forwardRef, useImperativeHandle, ForwardedRef, useCallback, useRef } from 'react';

// Import SpeechRecognition types 
import { useSpeechRecognition } from 'react-speech-recognition';
import SpeechRecognition from 'react-speech-recognition';

export interface SpeechRecognitionRef {
  startListening: () => void;
  stopListening: () => void;
  setMicrophoneSensitivity: (sensitivity: number) => void;
  setNoiseReduction: (value: number) => void;
  setVoiceBoost: (value: number) => void;
}

interface SpeechRecognitionProps {
  onResult: (text: string) => void;
  onListeningChange: (isListening: boolean) => void;
  onVolumeChange: (volume: number) => void;
  autoStart?: boolean;
  onLanguageChange?: (language: string) => void;
  microphoneSensitivity?: number;
}

const SpeechRecognitionComponent = forwardRef<SpeechRecognitionRef, SpeechRecognitionProps>(
  ({ onResult, onListeningChange, onVolumeChange, autoStart = false, onLanguageChange, microphoneSensitivity = 8.0 }, ref) => {
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastRecognizedLanguage, setLastRecognizedLanguage] = useState<string>('az-AZ');
    const [currentLanguage, setCurrentLanguage] = useState<string>('az-AZ');
    const [sensitivityValue, setSensitivityValue] = useState<number>(microphoneSensitivity);
    const [noiseReductionValue, setNoiseReductionValue] = useState(0.2);
    const [voiceBoostValue, setVoiceBoostValue] = useState(1.5);

    // Audio monitoring refs
    const microphoneStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const filterNodeRef = useRef<BiquadFilterNode | null>(null);
    const compressorRef = useRef<DynamicsCompressorNode | null>(null);
    const isProcessingAudioRef = useRef<boolean>(false);
    const animationFrameRef = useRef<number>(0);
    const volumeCallback = useRef<number>(0);
    
    // Single recognition instance
    const recognitionRef = useRef<any>(null);
    
    // Active recognition flag
    const isRecognitionActiveRef = useRef(false);
    
    const { listening, interimTranscript, finalTranscript, resetTranscript } = useSpeechRecognition({
      clearTranscriptOnListen: true,
    });
    
    // Set microphone sensitivity
    const setMicrophoneSensitivity = useCallback((sensitivity: number) => {
      setSensitivityValue(sensitivity);
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = sensitivity;
        console.log(`Mikrofon həssaslığı dəyişdirildi: ${sensitivity}`);
      }
    }, []);
    
    // Handle language change
    const handleLanguageChange = useCallback((language: string) => {
      console.log(`Dil dəyişdi: ${language}`);
      setLastRecognizedLanguage(language);
      setCurrentLanguage(language);
      if (onLanguageChange) {
        onLanguageChange(language);
      }
    }, [onLanguageChange]);
    
    // Handle listening state changes and report to parent
    const handleListeningChange = useCallback((listening: boolean) => {
      console.log(`Dinləmə vəziyyəti dəyişdi: ${listening ? 'aktivdir' : 'deaktivdir'}`);
      setIsListening(listening);
      onListeningChange(listening);
    }, [onListeningChange]);
    
    // Handle speech recognition results
    const handleSpeechResult = useCallback((event: any) => {
      // Extract the most confident result
      if (event.results && event.results.length > 0) {
        const result = event.results[event.results.length - 1];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          console.log(`Nitq tanıma nəticəsi: "${text}" (İnam: ${result[0].confidence.toFixed(2)})`);
          
          // Only process if text is not empty
          if (text) {
            onResult(text);
          }
        }
      }
    }, [onResult]);

    // Audio monitoring functions
    const startMicrophoneProcessing = async () => {
      try {
        if (isProcessingAudioRef.current) {
          console.log('Already processing audio, stopping previous processing');
          stopMicrophoneProcessing();
        }
        
        console.log('Starting microphone processing with Web Audio API');
        
        // Create audio context if not already existing
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        // Get user media with audio
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        microphoneStreamRef.current = stream;
        
        // Create source from microphone stream
        const micSource = audioContextRef.current.createMediaStreamSource(stream);
        
        // Create analyzer for volume detection
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 1024;
        analyserRef.current = analyser;
        
        // Create filter node for noise reduction
        const filter = audioContextRef.current.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 85; // Cut off low frequencies (background noise)
        filter.Q.value = noiseReductionValue; // Resonance/quality factor
        filterNodeRef.current = filter;
        
        // Create gain node for voice boost
        const gainNode = audioContextRef.current.createGain();
        gainNode.gain.value = voiceBoostValue; // Boost the voice
        gainNodeRef.current = gainNode;
        
        // Create compressor to prevent clipping
        const compressor = audioContextRef.current.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.knee.value = 30;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;
        compressorRef.current = compressor;
        
        // Connect the audio processing chain:
        // microphone -> filter -> gain -> compressor -> analyser
        micSource.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(compressor);
        compressor.connect(analyser);
        
        // We don't connect to audioContext.destination as we don't want to output the audio
        
        // Set flag to true as we're now processing
        isProcessingAudioRef.current = true;
        
        // Start the volume detection animation loop
        detectVolume();
        
      } catch (error) {
        console.error('Error starting microphone processing:', error);
      }
    };
    
    // Stop microphone processing
    const stopMicrophoneProcessing = () => {
      try {
        // Cancel any ongoing animation frame
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = 0;
        }
        
        // Stop all tracks in the media stream
        if (microphoneStreamRef.current) {
          microphoneStreamRef.current.getTracks().forEach(track => track.stop());
          microphoneStreamRef.current = null;
        }
        
        // Set flag to false as we're not processing anymore
        isProcessingAudioRef.current = false;
        
        // Reset volume to 0
        onVolumeChange?.(0);
        volumeCallback.current = 0;
        
        console.log('Microphone processing stopped');
      } catch (error) {
        console.error('Error stopping microphone processing:', error);
      }
    };
    
    // Detect and calculate volume from microphone input
    const detectVolume = () => {
      if (!analyserRef.current || !isProcessingAudioRef.current) {
        return;
      }
      
      try {
        const analyser = analyserRef.current;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        // Get frequency data
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        
        // Apply sensitivity factor to average
        const average = (sum / bufferLength) * (sensitivityValue / 10);
        
        // Update volume level with exponential smoothing
        volumeCallback.current = volumeCallback.current * 0.7 + average * 0.3;
        
        // Pass volume to callback
        onVolumeChange?.(volumeCallback.current);
        
        // Continue animation loop
        animationFrameRef.current = requestAnimationFrame(detectVolume);
      } catch (error) {
        console.error('Error in volume detection:', error);
      }
    };

    // Create and start recognition for a specific language
    const startRecognitionForLanguage = useCallback((language: string) => {
      try {
        // Prepare recognition
        const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
          const errorMsg = "Your browser doesn't support speech recognition. Please try using Chrome.";
          console.error(errorMsg);
          setError(errorMsg);
          return;
        }
        
        // Create recognition instance
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition as any;
        
        // Configure recognition
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language;
        
        // Set up event listeners
        recognition.onresult = handleSpeechResult;
        
        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          if (event.error === 'no-speech') {
            console.log('No speech detected, continuing to listen...');
          } else if (event.error === 'aborted') {
            console.log('Speech recognition aborted');
          } else {
            setError(`Speech recognition error: ${event.error}`);
            handleListeningChange(false);
          }
        };
        
        recognition.onend = () => {
          console.log('Speech recognition ended');
          if (isRecognitionActiveRef.current) {
            console.log('Restarting speech recognition...');
            recognition.start();
          } else {
            console.log('Speech recognition stopped');
            isRecognitionActiveRef.current = false;
            handleListeningChange(false);
          }
        };
        
        // Start recognition
        recognition.start();
        isRecognitionActiveRef.current = true;
        console.log(`Speech recognition started for language: ${language}`);
        
        // Update language state
        setCurrentLanguage(language);
        
      } catch (error) {
        console.error('Error creating speech recognition:', error);
        setError("Failed to create speech recognition. Please try again later.");
      }
    }, [handleSpeechResult, handleListeningChange]);
    
    // Start listening - can be called from parent component
    const startListening = useCallback(() => {
      if (isListening) {
        console.log('Already listening, returning...');
        return;
      }
      
      console.log('Starting speech recognition...');
      
      try {
        // Update state
        setError(null);
        handleListeningChange(true);
        
        // Start recognition
        const firstLanguage = 'az-AZ';
        startRecognitionForLanguage(firstLanguage);
        
        startMicrophoneProcessing();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setError("An error occurred while starting speech recognition. Please try again later.");
        handleListeningChange(false);
      }
    }, [isListening, startRecognitionForLanguage, handleListeningChange]);
    
    // Stop the recognition process
    const stopListening = useCallback(() => {
      try {
        console.log('Stopping speech recognition...');
        isRecognitionActiveRef.current = false;
        
        // Stop recognition
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
            recognitionRef.current = null;
          } catch (e) {
            console.warn('Error while stopping recognition instance:', e);
          }
        }
        
        // Update state
        handleListeningChange(false);
        
        stopMicrophoneProcessing();
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }, [handleListeningChange]);
    
    // Auto-start if enabled
    useEffect(() => {
      console.log('SpeechRecognition component mounted');
      
      if (autoStart) {
        console.log('Auto-starting speech recognition...');
        startListening();
      }
      
      // Cleanup on unmount
      return () => {
        console.log('SpeechRecognition component unmounting...');
        
        if (recognitionRef.current) {
          try {
            console.log('Stopping speech recognition on unmount...');
            isRecognitionActiveRef.current = false;
            recognitionRef.current.stop();
            recognitionRef.current = null;
          } catch (e) {
            console.warn('Error while stopping recognition on unmount:', e);
          }
        }
        stopMicrophoneProcessing();
      };
    }, [autoStart, startListening, stopMicrophoneProcessing]);
    
    // Make methods available to parent component
    useImperativeHandle(ref, () => ({
      startListening,
      stopListening,
      setMicrophoneSensitivity,
      setNoiseReduction: (value: number) => {
        console.log('Setting noise reduction value:', value);
        setNoiseReductionValue(value);
        
        // Apply noise reduction to filter node
        if (filterNodeRef.current) {
          const minQ = 0.1; // Minimum Q value (less filtering)
          const maxQ = 1.0; // Maximum Q value (more filtering)
          // Map the noise reduction value (0-1) to Q range
          const q = minQ + (maxQ - minQ) * value;
          filterNodeRef.current.Q.value = q;
        }
      },
      setVoiceBoost: (value: number) => {
        console.log('Setting voice boost value:', value);
        setVoiceBoostValue(value);
        
        // Apply voice boost to gain node
        if (gainNodeRef.current) {
          gainNodeRef.current.gain.value = value;
        }
        
        // Adjust compressor settings for voice boost
        if (compressorRef.current) {
          // Adjust threshold based on voice boost (lower threshold when boosting more)
          compressorRef.current.threshold.value = -24 - (value - 1) * 10;
          // Adjust ratio based on voice boost (higher ratio when boosting more)
          compressorRef.current.ratio.value = 3 + (value - 1) * 4;
        }
      }
    }), [startListening, stopListening, setMicrophoneSensitivity]);
    
    // Monitor listening state changes and notify parent
    useEffect(() => {
      console.log('Listening state changed internally:', listening);
      onListeningChange(listening);
    }, [listening, onListeningChange]);
    
    // Process final transcript
    useEffect(() => {
      if (finalTranscript !== '') {
        console.log('Final transcript received:', finalTranscript);
        onResult(finalTranscript);
        resetTranscript();
      }
    }, [finalTranscript, onResult, resetTranscript]);
    
    return (
      <div style={{ display: 'none' }}>
        {error && <div className="speech-error">{error}</div>}
      </div>
    );
  }
);

export default SpeechRecognitionComponent;