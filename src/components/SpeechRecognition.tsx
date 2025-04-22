import React, { useState, useEffect, forwardRef, useImperativeHandle, ForwardedRef, useCallback, useRef } from 'react';

interface SpeechRecognitionProps {
  onResult: (text: string) => void;
  onListeningChange: (isListening: boolean) => void;
  onVolumeChange?: (volume: number) => void;
  autoStart?: boolean;
  onLanguageChange?: (language: string) => void;
  microphoneSensitivity?: number; // Mikrofon həssaslıq parametri
}

export interface SpeechRecognitionRef {
  startListening: () => void;
  stopListening: () => void;
  setMicrophoneSensitivity: (level: number) => void; // Həssaslıq tənzimləmə metodu
}

const SpeechRecognition = forwardRef<SpeechRecognitionRef, SpeechRecognitionProps>(
  ({ onResult, onListeningChange, onVolumeChange, autoStart = false, onLanguageChange, microphoneSensitivity = 8.0 }, ref) => {
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastRecognizedLanguage, setLastRecognizedLanguage] = useState<string>('az-AZ');
    const [currentLanguage, setCurrentLanguage] = useState<string>('az-AZ');
    const [sensitivity, setSensitivity] = useState<number>(microphoneSensitivity);

    // Audio monitoring refs
    const microphoneStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null); // Gain node referansı
    
    // Single recognition instance
    const recognitionRef = useRef<any>(null);
    
    // Current language index
    const currentLangIndexRef = useRef(0);
    
    // Available languages
    const languages = ['az-AZ', 'tr-TR', 'ru-RU', 'en-US'];
    
    // Active recognition flag
    const isRecognitionActiveRef = useRef(false);
    
    // Set microphone sensitivity
    const setMicrophoneSensitivity = useCallback((level: number) => {
      setSensitivity(level);
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = level;
        console.log(`Mikrofon həssaslığı dəyişdirildi: ${level}`);
      }
    }, []);
    
    // Use callback to prevent excessive re-renders
    const handleListeningChange = useCallback((listening: boolean) => {
      if (isListening !== listening) {
        setIsListening(listening);
        onListeningChange(listening);
      }
    }, [isListening, onListeningChange]);

    // Audio monitoring functions
    const startAudioMonitoring = useCallback(async () => {
      try {
        // Get microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        microphoneStreamRef.current = stream;
        
        // Setup audio context and analyzer
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        
        // Create gain node for controlling sensitivity
        const gainNode = audioContext.createGain();
        gainNode.gain.value = sensitivity; // Başlanğıc həssaslıq dəyəri
        gainNodeRef.current = gainNode;
        
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        
        // Connect microphone to gain node, then to analyzer
        const microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(gainNode);
        gainNode.connect(analyser);
        
        // Create a data array to get volume levels
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        // Start volume monitoring
        const checkVolume = () => {
          if (!isListening || !analyserRef.current) return;
          
          analyserRef.current.getByteFrequencyData(dataArray);
          
          // Calculate average volume
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          
          // Send volume data to parent component if callback exists
          if (onVolumeChange) {
            onVolumeChange(average);
          }
          
          // Continue monitoring
          requestAnimationFrame(checkVolume);
        };
        
        checkVolume();
      } catch (error) {
        console.error('Error setting up audio monitoring:', error);
      }
    }, [isListening, onVolumeChange, sensitivity]);
    
    // Apply sensitivity changes when the value changes
    useEffect(() => {
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = sensitivity;
      }
    }, [sensitivity]);
    
    const stopAudioMonitoring = useCallback(() => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
        analyserRef.current = null;
        gainNodeRef.current = null;
        if (microphoneStreamRef.current) {
          microphoneStreamRef.current.getTracks().forEach(track => track.stop());
          microphoneStreamRef.current = null;
        }
      }
    }, []);

    // Monitor microphone volume levels
    useEffect(() => {
      if (isListening) {
        startAudioMonitoring();
        
        return () => {
          stopAudioMonitoring();
        };
      }
    }, [isListening, startAudioMonitoring, stopAudioMonitoring]);

    // Create and start recognition for a specific language
    const startRecognitionForLanguage = useCallback((language: string) => {
      try {
        if (recognitionRef.current) {
          // Stop any existing recognition
          try {
            recognitionRef.current.stop();
          } catch (e) {
            console.log('Error stopping existing recognition:', e);
          }
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
          setError("This browser doesn't support speech recognition. Please use Chrome, Edge, or Safari.");
          return false;
        }
        
        // Create a new recognition instance
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = language;
        recognition.maxAlternatives = 1;
        
        // Set recognition parameters for better sensitivity
        if ('speechRecognitionList' in window) {
          // Bəzi brauzerlərdə dəstəklənir
          try {
            // @ts-ignore - biraz həssaslığı artırmaq üçün
            recognition.audioThreshold = 0.2; // Daha aşağı səs həddi (əgər dəstəkləyirsə)
          } catch (e) {
            console.log('Audio threshold not supported');
          }
        }
        
        recognition.onstart = () => {
          console.log(`Speech recognition started for ${language}`);
          isRecognitionActiveRef.current = true;
          handleListeningChange(true);
        };
        
        recognition.onresult = (event: any) => {
          if (event.results.length > 0) {
            const transcript = Array.from(event.results)
              .map((result: any) => result[0])
              .map((result: any) => result.transcript)
              .join('');
            
            if (event.results[0].isFinal) {
              console.log(`Final result from ${language}:`, transcript);
              setLastRecognizedLanguage(language);
              onResult(transcript);
              
              // We got a result, stop recognition
              try {
                recognition.stop();
              } catch (e) {
                console.log('Error stopping recognition after result:', e);
              }
            }
          }
        };
        
        recognition.onerror = (event: any) => {
          console.error(`Speech recognition error in ${language}:`, event.error);
          
          if (event.error === 'not-allowed') {
            setError("Microphone access was denied. Please enable microphone access to use speech recognition.");
          } else if (event.error === 'network') {
            setError("Network error occurred. Please check your internet connection.");
          } else if (event.error === 'no-speech') {
            // no-speech xətası baş verdikdə dinləməni dayandırmayaq, sadəcə loglanma edək
            console.log("No speech detected, continuing recognition...");
            
            // Ən qısa müddətdə eyni dili yenidən başladaq (sadəcə rotation etməyək)
            try {
              if (recognitionRef.current) {
                recognitionRef.current.stop();
              }
            } catch (e) {
              console.log('Error stopping recognition after no-speech error:', e);
            }
            
            // 100ms sonra eyni dillə yenidən başlayaq
            setTimeout(() => {
              if (isListening) {
                console.log(`Restarting ${language} after no-speech error`);
                startRecognitionForLanguage(language);
              }
            }, 100);
            
            return; // Digər adi xəta emalını bypass edək
          }
          
          isRecognitionActiveRef.current = false;
          
          // Try to start with next language if still in listening mode
          if (isListening) {
            setTimeout(rotateLanguage, 300);
          }
        };
        
        recognition.onend = () => {
          console.log(`Speech recognition ended for ${language}`);
          isRecognitionActiveRef.current = false;
          
          // If we're still in listening mode, move to the next language
          if (isListening) {
            setTimeout(rotateLanguage, 300);
          } else {
            handleListeningChange(false);
          }
        };
        
        // Save the recognition instance
        recognitionRef.current = recognition;
        
        // Start recognition
        recognition.start();
        return true;
      } catch (error) {
        console.error('Error starting speech recognition for ' + language + ':', error);
        setTimeout(rotateLanguage, 500);
        return false;
      }
    }, [handleListeningChange, isListening, onResult]);
    
    // Rotate through languages
    const rotateLanguage = useCallback(() => {
      if (!isListening) return;
      
      // Əgər aktiv tanıma varsa, dayanmaq
      if (isRecognitionActiveRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.log('Error stopping active recognition during rotation:', e);
        }
      }
      
      // Move to next language
      currentLangIndexRef.current = (currentLangIndexRef.current + 1) % languages.length;
      const nextLanguage = languages[currentLangIndexRef.current];
      
      console.log(`Rotating to next language: ${nextLanguage}`);
      startRecognitionForLanguage(nextLanguage);
    }, [isListening, startRecognitionForLanguage]);

    const handleLanguageUpdate = useCallback(
      (language: string) => {
        setCurrentLanguage(language);
        recognitionRef.current.lang = language;
        onLanguageChange?.(language);
      },
      [onLanguageChange]
    );

    // Start the recognition process
    const startListening = useCallback(() => {
      if (isListening) {
        console.log('Already listening, not starting again');
        return;
      }
      
      try {
        console.log('Starting speech recognition cycle');
        handleListeningChange(true);
        
        // Start with first language
        currentLangIndexRef.current = 0;
        const firstLanguage = languages[0];
        startRecognitionForLanguage(firstLanguage);
        
        startAudioMonitoring();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setError("An error occurred while starting speech recognition. Please try again later.");
        handleListeningChange(false);
      }
    }, [isListening, startAudioMonitoring, startRecognitionForLanguage, handleListeningChange]);
    
    // Stop the recognition process
    const stopListening = useCallback(() => {
      try {
        console.log('Stopping speech recognition');
        handleListeningChange(false);
        
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (e) {
            console.log('Error stopping recognition:', e);
          }
          recognitionRef.current = null;
        }
        
        stopAudioMonitoring();
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }, [handleListeningChange, stopAudioMonitoring]);
    
    // Auto-start if enabled
    useEffect(() => {
      if (autoStart) {
        const timer = setTimeout(() => {
          console.log('Auto-starting speech recognition...');
          startListening();
        }, 1000);
        
        return () => clearTimeout(timer);
      }
    }, [autoStart, startListening]);
    
    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch (e) {
            console.error('Error aborting recognition during cleanup:', e);
          }
        }
        stopAudioMonitoring();
      };
    }, [stopAudioMonitoring]);
    
    // Make methods available to parent component
    useImperativeHandle(ref, () => ({
      startListening,
      stopListening,
      setMicrophoneSensitivity
    }), [startListening, stopListening, setMicrophoneSensitivity]);
    
    return (
      <div className="speech-recognition">
        {error && <div className="error">{error}</div>}
        <div className="controls">
          <button 
            onClick={isListening ? stopListening : startListening}
            className={isListening ? 'listening' : ''}
            style={{ display: 'none' }}
          >
            {isListening ? 'Stop Listening' : 'Start Listening'}
          </button>
        </div>
        {isListening && (
          <div className="status" style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.5)', color: 'white', padding: '5px 10px', borderRadius: '4px' }}>
            Səs tanıma aktiv... ({lastRecognizedLanguage})
          </div>
        )}
      </div>
    );
  }
);

export default SpeechRecognition;