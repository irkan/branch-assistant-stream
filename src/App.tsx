import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import Scene3D from './components/Scene3D';
import SpeechRecognition, { SpeechRecognitionRef } from './components/SpeechRecognition';
import InterruptionHandler from './components/InterruptionHandler';
import { CustomerMemoryUtils, CustomerData } from './components/CustomerMemory';
import * as faceapi from 'face-api.js';
import { SimaResponse } from './components/SimaIntegration';
import ChatBox from './components/ChatBox';
import OpenAI from "openai";

// OpenAI API client yaradırıq
const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY, // API key .env faylından götürülür
  dangerouslyAllowBrowser: true // Brauzer mühitində çalışmasına icazə veririk
});

// Mətni səsə çevirmək üçün funksiya
const textToSpeech = async (text: string): Promise<ArrayBuffer | null> => {
  try {
    console.log("OpenAI ilə səsləndirmə başladı:", text.substring(0, 50) + "...");
    
    const response = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts", // daha sürətli model
      voice: "alloy", // qadın səsi
      input: text,
      instructions: "Speak in a cheerful, positive, slowly tone and Azerbaijani language.",
      speed: 0.25,
      response_format: "wav",
    });
    
    const arrayBuffer = await response.arrayBuffer();
    console.log("OpenAI səsləndirmə tamamlandı, audio ölçüsü:", arrayBuffer.byteLength, "bayt");
    
    return arrayBuffer;
  } catch (error) {
    console.error("OpenAI səsləndirmə xətası:", error);
    return null;
  }
};

// Audio buffer-i səsləndirmək üçün funksiya
const playAudioFromBuffer = async (audioBuffer: ArrayBuffer, onComplete?: () => void, text?: string, phonemeSetter?: (phoneme: string) => void): Promise<void> => {
  try {
    // Audio Context yaradaq
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Audio buffer decodlamaq
    const decodedData = await audioContext.decodeAudioData(audioBuffer);
    
    // Save audio as blob for sync processing
    const blob = audioBufferToBlob(decodedData);
    const audioUrl = URL.createObjectURL(blob);
    
    console.log("Səs faylı üçün audio URL yaradıldı:", audioUrl);
    
    // Audio Source node yaradaq
    const source = audioContext.createBufferSource();
    source.buffer = decodedData;
    
    // Audio çıxışına bağlayaq
    source.connect(audioContext.destination);
    
    // Mətn varsa, səslə sinxronizasiya edək
    if (text && phonemeSetter) {
      // Burada mətn və səs sinxronizasiyası edilir
      syncTextWithAudio(text, decodedData.duration * 1000, source, phonemeSetter);
    }
    
    // Səsləndirməni başladaq
    source.start(0);
    
    // Səsləndirmə bitdikdə bildiriş
    source.onended = () => {
      console.log("Səsləndirmə bitdi");
      if (onComplete) {
        onComplete();
      }
    };
    
  } catch (error) {
    console.error("Audio buffer səsləndirmə xətası:", error);
    if (onComplete) {
      onComplete();
    }
  }
};

// Mətni səslə sinxronizasiya edən funksiya
const syncTextWithAudio = (
  text: string, 
  durationMs: number, 
  audioSource: AudioBufferSourceNode,
  setPhoneme: (phoneme: string) => void
) => {
  const characters = text.split('');
  const intervalMs = durationMs / characters.length;
  
  console.log(`Character sync: ${characters.length} chars, ${durationMs.toFixed(2)}ms duration, ${intervalMs.toFixed(2)}ms per char`);
  
  let currentIndex = 0;
  
  // Audio bitdikdə interval-ı dayandırmaq üçün ref
  const intervalIdRef = { current: 0 };
  
  // Səsləndirmə bitdikdə interval-ı təmizləyək
  audioSource.onended = () => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      console.log("Character sync stopped");
      // Make sure we reset to silence
      setPhoneme("_");
    }
  };
  
  // Mətni ardıcıl göstərmə interval-ı
  intervalIdRef.current = window.setInterval(() => {
    if (currentIndex < characters.length) {
      const currentChar = characters[currentIndex];
      
      // Hərfi kiçik hərfə çevirib fonem kimi ötürürük
      // Boşluq və nöqtələmə işarələri üçün "_" (silence)
      const nonSpeechChars = [' ', '.', ',', '!', '?', ':', ';'];
      const phoneme = nonSpeechChars.includes(currentChar) ? '_' : currentChar.toLowerCase();
      
      // State-ə fonem məlumatını ötürürük
      setPhoneme(phoneme);
      
      currentIndex++;
    } else {
      clearInterval(intervalIdRef.current);
      setPhoneme("_"); // Sonda səssiz
      console.log("Character sync complete - reset to silence");
    }
  }, intervalMs);
};

// Convert AudioBuffer to Blob
const audioBufferToBlob = (audioBuffer: AudioBuffer): Blob => {
  // Get audio data
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  
  // Create WAV file
  const wavFile = new Float32Array(length * numberOfChannels);
  
  // Copy audio data
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      wavFile[i * numberOfChannels + channel] = channelData[i];
    }
  }
  
  // Convert to 16-bit PCM WAV
  const audioData = encodeWAV(wavFile, numberOfChannels, sampleRate);
  
  return new Blob([audioData], { type: 'audio/wav' });
};

// Encode as WAV
const encodeWAV = (samples: Float32Array, numChannels: number, sampleRate: number): DataView => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  
  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 4, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, numChannels * 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);
  
  // Convert Float32 to Int16
  floatTo16BitPCM(view, 44, samples);
  
  return view;
};

const writeString = (view: DataView, offset: number, string: string): void => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

const floatTo16BitPCM = (output: DataView, offset: number, input: Float32Array): void => {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
};

// AudioAnalyzer komponenti əlavə edirik
interface AudioAnalyzerProps {
  audioBlob: Blob | null;
  isPlaying: boolean;
}

const AudioAnalyzer: React.FC<AudioAnalyzerProps> = ({ audioBlob, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (audioBlob && isPlaying) {
      const startAnalyzing = async () => {
        try {
          // Əgər əvvəlki analiz varsa təmizləyirik
          if (audioContextRef.current) {
            try {
              if (audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
              }
            } catch (err) {
              console.warn("AudioContext bağlama xətası:", err);
            }
          }
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
          }

          console.log("🔍 AudioAnalyzer: Analiz üçün hazırlanır, amma səslənmiR");
          
          // AudioContext yaradırıq
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContextRef.current = audioCtx;

          // Analyzer node yaradırıq
          const analyzer = audioCtx.createAnalyser();
          analyzer.fftSize = 2048;
          const bufferLength = analyzer.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyzerRef.current = analyzer;

          // Vizualizasiya üçün canvas hazırla
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Sadəcə boş analiz visualizasiyası göstəririk
              // Biz burada artıq audio yaratmırıq, çünki digər kod bunu edir
              const drawVisualization = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Boş analiz göstər
                ctx.fillStyle = 'rgba(0, 204, 255, 0.2)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Məlumat göstər
                ctx.fillStyle = 'white';
                ctx.font = '14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Audio analiz edilir (təkrar səsləndirilmir)', canvas.width/2, canvas.height/2);
                
                animationRef.current = requestAnimationFrame(drawVisualization);
              };
              
              drawVisualization();
            }
          }
        } catch (err) {
          console.error('Səs analizi zamanı xəta:', err);
        }
      };
      
      startAnalyzing();
    }
    
    // Təmizləmə
    return () => {
      if (audioContextRef.current) {
        try {
          if (audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
          }
        } catch (err) {
          console.warn("AudioContext bağlama xətası (təmizləmə):", err);
        }
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioBlob, isPlaying]);
  
  return (
    <div className="audio-analyzer" style={{ 
      position: 'absolute', 
      bottom: '10px', 
      left: '50%', 
      transform: 'translateX(-50%)',
      width: '300px',
      display: isPlaying ? 'block' : 'none'
    }}>
      <canvas ref={canvasRef} width={300} height={100} style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '8px' }} />
      <div style={{ color: 'white', fontSize: '12px', marginTop: '5px', textAlign: 'center' }}>
        Audio Analizi (səssiz)
      </div>
    </div>
  );
};

// Add a global static counter to track audio files
// Global özəllikdir, hər cari session müddətində artacaq
let audioFileCounter = 0;
// Track the current audio file being analyzed
let currentAnalysisNumber = 1;

// Add a type declaration for the window property at the top of the file
declare global {
  interface Window {
    faceVideoErrorLogged?: boolean;
    faceNotDetectedLogged?: boolean;
    AUDIO_ANALYSIS_STARTED?: boolean;
    audioAnalysisAlertShown?: boolean;
    previousLipSyncValue?: number; // Əlavə edildi
  }
}

// Təhlükəsiz fixed metodu - NaN və Infinity dəyərlərdən qoruyur
const safeFixed = (value: number, digits: number = 2): string => {
  if (isNaN(value) || !isFinite(value)) {
    return '0.' + '0'.repeat(digits);
  }
  return value.toFixed(digits);
};

function App() {
  // Video and canvas references
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Speech recognition refs
  const speechRecognitionRef = useRef<SpeechRecognitionRef>(null);
  const microphoneActivationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Authentication and user states
  const [currentCustomer, setCurrentCustomer] = useState<CustomerData | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(true);
  const [simaUserData, setSimaUserData] = useState<SimaResponse | null>(null);
  
  // Face detection states
  const [detectedFaceImage, setDetectedFaceImage] = useState<string | null>(null);
  const [isFaceDetected, setIsFaceDetected] = useState(false);

  // Speech and content states
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  // Using phoneme-based lip sync instead of generic value
  const [currentPhoneme, setCurrentPhoneme] = useState<string>("_"); // Default to silent
  const [userSpeech, setUserSpeech] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasGreetingSent, setHasGreetingSent] = useState(false);
  const [micSensitivity, setMicSensitivity] = useState<number>(8.0); // Mikrofon həssaslığı dəyişəni

  // State variables for chat functionality
  const [messages, setMessages] = useState<{ text: string; sender: 'user' | 'assistant' }[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [volume, setVolume] = useState<number>(0);
  const [detectedText, setDetectedText] = useState<string>('');

  // Face detection states
  const [faceDetected, setFaceDetected] = useState<boolean>(false);
  const [detectedFace, setDetectedFace] = useState<string | undefined>(undefined);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // State variables for audio analysis
  const [currentAudioBlob, setCurrentAudioBlob] = useState<Blob | null>(null);
  
  // Müştəri referans məlumatlarını saxlamaq üçün
  const [referenceCustomerFace, setReferenceCustomerFace] = useState<Float32Array | null>(null);
  const [lastActiveTime, setLastActiveTime] = useState<number>(Date.now());

  // Handle listening state change - use callback to prevent re-renders
  const handleListeningChange = useCallback((listening: boolean) => {
    console.log(`Listening state changed to: ${listening}`);
    setIsListening(listening);
  }, []);
  
  // Webhook JSON cavabını parse edib output sahəsini əldə edən funksiya
  const parseAndSpeakResponse = useCallback(async (jsonString: string) => {
    try {
      // JSON cavabı parse et
      const jsonResponse = JSON.parse(jsonString);
      
      if (jsonResponse && jsonResponse.output) {
        const outputText = jsonResponse.output;
        console.log("JSON cavabından çıxarılmış mətn:", outputText);
        
        // Mətni state'ə əlavə et
        setAiResponse(outputText);
        
        // OpenAI ilə səsləndirməyə başla
        const audioBuffer = await textToSpeech(outputText);
        if (audioBuffer) {
          setIsSpeaking(true);
          
          // Səsləndirmə bitdikdən sonra çağrılacaq funksiya
          const onSpeechComplete = () => {
            setIsSpeaking(false);
            
            // Reset the phoneme to silence
            setCurrentPhoneme("_");
            console.log("Səsləndirmə bitdi - silence phoneme");
            
            // Müəyyən bir məsafədən sonra nitq tanımaya başla
            setTimeout(() => {
              console.log("Nitq tanıma yenidən başladıldı (səsləndirmə bitdikdən sonra)");
              if (speechRecognitionRef.current) {
                speechRecognitionRef.current.startListening();
              }
            }, 300);
          };
          
          // Səsləndirməyi başladaq və bitdikdən sonra callback funksiyasını çağıraq
          await playAudioFromBuffer(audioBuffer, onSpeechComplete, outputText, setCurrentPhoneme);
        } else {
          console.error("Səsləndirmə üçün audio buffer yaradıla bilmədi");
          setIsSpeaking(false);
        }
      } else {
        console.error("JSON cavabından mətn çıxarıla bilmədi:", jsonResponse);
      }
    } catch (error) {
      console.error("Webhook cavabı parsing xətası:", error);
    }
  }, [setCurrentPhoneme]);
  
  // Handle failures when webhook doesn't work
  const handleWebhookFailure = useCallback(() => {
    console.error("Webhook communication failed");
    setIsSpeaking(false);
    
    // Resume speech recognition after failure
    setTimeout(() => {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.startListening();
      }
    }, 500);
  }, []);
  
  // Handle speech recognition result - mikrofon vasitəsilə alınmış mətnləri webhook servisinə göndərir
  const handleSpeechResult = useCallback(async (text: string) => {
    try {
      console.info("%c 🎤 NITQ TANIMLANDI:", "background: #4CAF50; color: white; padding: 5px; border-radius: 5px; font-weight: bold;", text);
      
      // Pause speech recognition while processing
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stopListening();
      }
      
      // Set state to indicate processing
      setIsSpeaking(true);
      
      // Store input for processing
      const userInput = text;
      
      // Send data to webhook and get audio file in response
      const webhookUrl = process.env.REACT_APP_WEBHOOK_URL;
      console.info('WEBHOOK URL:', webhookUrl || 'tapılmadı');
      
      if (webhookUrl) {
        try {
          
          console.info("%c 🌐 Webhook sorğusu hazırlanır:", "background: #2196F3; color: white; padding: 5px; border-radius: 5px;", {
            url: webhookUrl,
            method: 'POST',
            body: {
              message: userInput,
              timestamp: new Date().toISOString(),
              source: 'speech_recognition'
            }
          });
          
          // AJAX sorğu əvəzinə XMLHttpRequest istifadə edək - daha aşağı səviyyədə debug olar
          const xhr = new XMLHttpRequest();
          xhr.open('POST', webhookUrl, true);
          xhr.setRequestHeader('Content-Type', 'application/json');
          
          // Progress event listener
          xhr.upload.onprogress = function(e) {
            console.info('Webhook sorğusu göndərilir:', Math.round((e.loaded / e.total) * 100) + '%');
          };
          
          // Load event listener
          xhr.onload = async function() {
            console.info('Webhook cavabı alındı, status:', xhr.status);
            
            if (xhr.status === 200) {
              try {
                // Webhook-dən gələn JSON mətnini əldə et
                const responseText = xhr.responseText;
                console.info('Webhook-dən mətn cavabı alındı:', responseText);
                
                // Məlumatı işləmə və konsola çap etmə
                console.log("%c 🤖 AI Cavabı (JSON):", "background: #9C27B0; color: white; padding: 5px; border-radius: 5px; font-weight: bold;", responseText);
                
                // JSON-u parse et və səsləndir
                await parseAndSpeakResponse(responseText);
              } catch (textError: any) {
                console.info('Mətn emalı xətası:', textError);
                console.error(`Mətn emalı xətası: ${textError.message || textError}`);
                handleWebhookFailure();
              }
            } else {
              console.info('Webhook xətası:', xhr.status, xhr.statusText);
              console.error(`Webhook xətası: ${xhr.status} ${xhr.statusText}`);
              handleWebhookFailure();
            }
          };
          
          // Error event listener
          xhr.onerror = function(e) {
            console.info('Webhook network xətası:', e);
            console.error('Webhook bağlantı xətası baş verdi.');
            handleWebhookFailure();
          };
          
          // Response type-ı text olaraq dəyişdiririk (əvvəl blob idi)
          xhr.responseType = 'text';
          
          // Send the request
          const data = JSON.stringify({
            message: userInput,
            timestamp: new Date().toISOString(),
            source: 'speech_recognition'
          });
          
          console.info('Webhook sorğusu göndərilir...');
          xhr.send(data);
          
        } catch (error) {
          console.error('Webhook sorğusu göndərmə xətası:', error);
          handleWebhookFailure();
        }
      } else {
        console.error('Webhook URL tapılmadı, webhook sorğusu göndərilmir.');
        handleWebhookFailure();
      }
    } catch (error) {
      console.error('Ümumi xəta:', error);
      handleWebhookFailure();
    }
  }, [parseAndSpeakResponse, handleWebhookFailure]);
  
  // Start speaking
  const startSpeaking = useCallback(async (text: string) => {
    console.log('Started speaking:', text);
    setIsSpeaking(true);
    setIsListening(false);
    
    // Stop listening while speaking
    if (speechRecognitionRef.current) {
      console.log('Stopping speech recognition during speaking');
      speechRecognitionRef.current.stopListening();
    } else {
      console.warn('Speech recognition ref is null, cannot stop listening');
    }

    // Birbaşa textToSpeech ilə səsləndirmə
    try {
      console.log("Mətn birbaşa səsləndirilir:", text);
      
      // OpenAI ilə səsləndirməyə başla
      const audioBuffer = await textToSpeech(text);
      if (audioBuffer) {
        // Səsləndirmə bitdikdən sonra çağrılacaq funksiya
        const onSpeechComplete = () => {
          setIsSpeaking(false);
          
          // Reset the phoneme to silence
          setCurrentPhoneme("_");
          console.log("Səsləndirmə bitdi - silence phoneme");
          
          // Müəyyən bir məsafədən sonra nitq tanımaya başla
          setTimeout(() => {
            console.log("Nitq tanıma yenidən başladıldı (səsləndirmə bitdikdən sonra)");
            if (speechRecognitionRef.current) {
              speechRecognitionRef.current.startListening();
            }
          }, 300);
        };
        
        // Səsləndirməyi başladaq və bitdikdən sonra callback funksiyasını çağıraq
        await playAudioFromBuffer(audioBuffer, onSpeechComplete, text, setCurrentPhoneme);
      } else {
        console.error("Səsləndirmə üçün audio buffer yaradıla bilmədi");
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error("Səsləndirmə xətası:", error);
      setIsSpeaking(false);
      
      // Xəta zamanı nitq tanımaya davam et
      setTimeout(() => {
        if (speechRecognitionRef.current) {
          speechRecognitionRef.current.startListening();
        }
      }, 500);
    }
  }, [setCurrentPhoneme]);
  
  // Handle playback complete
  const handlePlaybackComplete = useCallback(() => {
    console.log('Speech playback complete, activating microphone...');
    setIsSpeaking(false);
    setCurrentPhoneme("_");
    
    // Clear any previous timeouts
    clearTimeout(microphoneActivationTimerRef.current || undefined);
    
    // Delay a bit before activating microphone
    microphoneActivationTimerRef.current = setTimeout(() => {
      // Only try to start listening if we're not already speaking
      if (!isSpeaking) {
        setIsListening(true);
        
        // Start speech recognition manually
        if (speechRecognitionRef.current) {
          console.log('Starting speech recognition after playback');
          try {
            speechRecognitionRef.current.startListening();
            console.log('Successfully started speech recognition');
          } catch (error) {
            console.error('Error starting speech recognition:', error);
          }
        } else {
          console.warn('Speech recognition ref is null, cannot start listening');
          
          // If ref is not available, try again in 500ms
          setTimeout(() => {
            if (speechRecognitionRef.current) {
              console.log('Delayed start of speech recognition after playback');
              try {
                speechRecognitionRef.current.startListening();
                console.log('Successfully started delayed speech recognition');
              } catch (error) {
                console.error('Error starting delayed speech recognition:', error);
              }
            }
          }, 500);
        }
      }
    }, 300);
  }, [isSpeaking]);
  
  // Handle interruption
  const handleInterruption = useCallback(() => {
    console.log('Speech interrupted, activating microphone...');
    setIsSpeaking(false);
    setCurrentPhoneme("_");
    
    // Clear any previous timeouts
    clearTimeout(microphoneActivationTimerRef.current || undefined);
    
    // Delay a bit before activating microphone
    microphoneActivationTimerRef.current = setTimeout(() => {
      // Only try to start listening if we're not already speaking
      if (!isSpeaking) {
        setIsListening(true);
        
        // Start speech recognition manually after interruption
        if (speechRecognitionRef.current) {
          console.log('Starting speech recognition after interruption');
          speechRecognitionRef.current.startListening();
        } else {
          console.warn('Speech recognition ref is null, cannot start listening');
          
          // If ref is not available, try again in 500ms
          setTimeout(() => {
            if (speechRecognitionRef.current) {
              console.log('Delayed start of speech recognition after interruption');
              speechRecognitionRef.current.startListening();
            }
          }, 500);
        }
      }
    }, 300);
  }, [isSpeaking]);
  
  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      // Use CDN for models instead of local files to avoid tensor shape mismatch issues
      const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
      
      try {
        // Load models sequentially with error handling for each
        console.log('Loading face-api models from CDN...');
        
        try {
          await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
          console.log('TinyFaceDetector model loaded successfully');
        } catch (e) {
          console.error('Failed to load TinyFaceDetector model:', e);
        }
        
        try {
          await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
          console.log('FaceLandmark68 model loaded successfully');
        } catch (e) {
          console.error('Failed to load FaceLandmark68 model:', e);
        }
        
        try {
          await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
          console.log('FaceRecognition model loaded successfully');
        } catch (e) {
          console.error('Failed to load FaceRecognition model:', e);
        }
        
        // Only set as loaded if we have at least the detector
        if (faceapi.nets.tinyFaceDetector.isLoaded) {
          setIsModelLoaded(true);
          console.log('Face recognition models loaded successfully');
          startVideo();
        } else {
          console.error('Essential face detection model failed to load');
          // Continue without face recognition
          setIsModelLoaded(false);
        }
      } catch (error) {
        console.error('Error in face-api model loading process:', error);
        // Continue without face recognition
        setIsModelLoaded(false);
      }
    };
    
    loadModels();
    
    // Cleanup
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);
  
  // Start video stream with improved error handling
  const startVideo = async () => {
    if (!videoRef.current) {
      console.error('Video reference not available, cannot start video');
      return;
    }
    
    try {
      console.log('Attempting to access camera...');
      console.log('Available devices:');
      
      try {
        // List available devices for debugging
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length === 0) {
          console.warn('No video input devices found!');
          setCameraError("Heç bir kamera tapılmadı. Zəhmət olmasa kamera qoşulduğundan əmin olun.");
        } else {
          console.log('Video devices:', videoDevices.map(d => `${d.label || 'Unnamed device'} (${d.deviceId.substring(0, 8)}...)`));
        }
      } catch (enumError) {
        console.error('Error listing devices:', enumError);
      }
      
      // First try to stop any existing streams
      if (videoRef.current.srcObject) {
        console.log('Stopping existing video stream');
        const existingStream = videoRef.current.srcObject as MediaStream;
        existingStream.getTracks().forEach(track => {
          console.log(`Stopping track: ${track.label || 'unnamed'} (${track.kind})`);
          track.stop();
        });
        videoRef.current.srcObject = null;
      }
      
      console.log('Requesting camera with HD resolution');
      
      // Request camera with constraints - try HD resolution first
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });
      
      if (!stream) {
        throw new Error('Camera stream is null or undefined');
      }
      
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0) {
        throw new Error('No video tracks in the stream');
      }
      
      console.log(`Got ${videoTracks.length} video tracks:`, 
        videoTracks.map(track => `${track.label} (enabled: ${track.enabled}, muted: ${track.muted})`));
      
      // Set the stream to video element
      videoRef.current.srcObject = stream;
      console.log('Camera stream set to video element');
      
      // Attach more detailed event listeners
      videoRef.current.onloadedmetadata = () => {
        console.log('Video element loaded metadata, dimensions:', 
          `${videoRef.current?.videoWidth}x${videoRef.current?.videoHeight}`);
      };
      
      videoRef.current.onloadeddata = () => {
        console.log('Video element loaded data, ready state:', videoRef.current?.readyState);
      };
      
      // Force video play (needed in some browsers)
      console.log('Attempting to play video element');
      const playPromise = videoRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('Video is now playing successfully');
            
            // Clear any previous error
            setCameraError(null);
            
            // Check actual dimensions after playing
            setTimeout(() => {
              if (videoRef.current) {
                console.log('Video dimensions after play:', 
                  `${videoRef.current.videoWidth}x${videoRef.current.videoHeight} (ready: ${videoRef.current.readyState})`);
              }
            }, 500);
          })
          .catch(err => {
            console.error('Error playing video after getting stream:', err);
            setCameraError("Videonu başlatmaq mümkün olmadı. Zəhmət olmasa səhifədəki bir yerə klikləyin.");
            
            // Try to play again after user interaction
            const playVideoOnClick = () => {
              console.log('User clicked, trying to play video again');
              videoRef.current?.play()
                .then(() => {
                  console.log('Video started playing after user interaction');
                  setCameraError(null);
                })
                .catch(playErr => {
                  console.error('Still failed to play after user interaction:', playErr);
                });
              document.removeEventListener('click', playVideoOnClick);
            };
            document.addEventListener('click', playVideoOnClick);
          });
      }
      
      // Set up event listeners to detect if camera track ends unexpectedly
      stream.getVideoTracks().forEach(track => {
        track.onended = () => {
          console.log('Camera track ended unexpectedly');
          setCameraError("Kamera bağlantısı kəsildi. Yenidən qoşulmağa çalışılır...");
          
          // Try to restart video after small delay
          setTimeout(() => startVideo(), 1000);
        };
        
        track.onmute = () => {
          console.log('Camera track muted');
          setCameraError("Kamera müvəqqəti olaraq əlçatan deyil. Yenidən qoşulmağa çalışılır...");
        };
        
        track.onunmute = () => {
          console.log('Camera track unmuted');
          setCameraError(null);
        };
      });
    } catch (error) {
      console.error('Error accessing camera:', error);
      
      // Show detailed error message
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Camera access error details:', errorMessage);
      
      // Show user-friendly error message
      setCameraError(`Kameraya giriş mümkün olmadı: ${errorMessage}. Zəhmət olmasa icazə verin vəya başqa kamera seçin.`);
      
      // Try again with lower quality if high quality failed
      try {
        console.log('Trying with lower quality camera settings...');
        const lowQualityStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = lowQualityStream;
          videoRef.current.play().catch(playErr => {
            console.error('Error playing low quality video:', playErr);
          });
          console.log('Camera accessed with lower quality');
          
          // Clear error message
          setCameraError(null);
        }
      } catch (lowQualityError) {
        console.error('Failed to access camera even with lower quality:', lowQualityError);
        setCameraError("Kameranıza daxil olmaq mümkün olmadı. Lütfən kamera icazələrini yoxlayın və ya başqa bir kameradan istifadə edin.");
      }
    }
  };
  
  // Direct capture from video element instead of using canvas
  const captureVideoFrame = useCallback((): string | null => {
    try {
      // Reference to video element
      const video = videoRef.current;
      if (!video || video.readyState !== 4) {
        console.error('Video not ready for frame capture');
        return null;
      }
      
      // Get actual video dimensions
      const width = video.videoWidth;
      const height = video.videoHeight;
      
      console.log('Capturing full video frame from dimensions:', width, height);
      
      // Create temp canvas with video dimensions
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) {
        console.error('Failed to get canvas context');
        return null;
      }
      
      // Draw the full video frame to canvas
      tempCtx.drawImage(video, 0, 0, width, height);
      
      // Improve image quality
      const imageData = tempCtx.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      // Apply basic image enhancement
      for (let i = 0; i < data.length; i += 4) {
        // Increase brightness and contrast slightly
        data[i] = Math.min(255, Math.max(0, (data[i] - 128) * 1.2 + 138)); // Red
        data[i+1] = Math.min(255, Math.max(0, (data[i+1] - 128) * 1.2 + 138)); // Green
        data[i+2] = Math.min(255, Math.max(0, (data[i+2] - 128) * 1.2 + 138)); // Blue
      }
      
      tempCtx.putImageData(imageData, 0, 0);
      
      // Convert to high quality JPEG
      const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.95);
      
      console.log('Captured frame, data URL length:', dataUrl.length);
      return dataUrl;
    } catch (error) {
      console.error('Error capturing video frame:', error);
      return null;
    }
  }, []);
  
  // Greet customer based on whether they're new or returning
  const greetCustomer = useCallback((isNew: boolean) => {
    setIsProcessing(true);
    
    // Generic greeting if Sima API fails
    setTimeout(() => {
      const greeting = isNew 
        ? "Salam! ABB Banka xoş gəlmisiniz. Mən Ayla, sizin virtual köməkçinizəm. Sizə necə kömək edə bilərəm?"
        : "Yenidən xoş gəldiniz! Sizə necə kömək edə bilərəm?";
      
      setAiResponse(greeting);
      setIsProcessing(false);
      startSpeaking(greeting);
    }, 1000);
  }, [startSpeaking]);
  
  // Recognize customer from face descriptor
  const recognizeCustomer = useCallback(async (faceDescriptor: Float32Array, canvas: HTMLCanvasElement) => {
    const currentTime = Date.now();
    const timeThreshold = 30 * 60 * 1000; // 30 minutes in milliseconds
    
    // Check if this face matches any existing customer
    let matchedCustomer: CustomerData | null = null;
    let isNew = true;
    
    const customers = CustomerMemoryUtils.loadCustomers();
    
    for (const customer of customers) {
      const distance = faceapi.euclideanDistance(faceDescriptor, customer.faceDescriptor);
      
      // If distance is below threshold, consider it a match
      if (distance < 0.6) {
        matchedCustomer = customer;
        isNew = false;
        
        // Update last seen time
        customer.lastSeen = currentTime;
        CustomerMemoryUtils.saveCustomers(customers);
        break;
      }
    }
    
    // If no match found, create new customer
    if (!matchedCustomer) {
      const newCustomer: CustomerData = {
        id: `customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        faceDescriptor,
        lastSeen: currentTime,
        conversations: []
      };
      
      customers.push(newCustomer);
      CustomerMemoryUtils.saveCustomers(customers);
      matchedCustomer = newCustomer;
    }
    
    // Only update state if customer changed
    if (currentCustomer?.id !== matchedCustomer.id) {
      // Update customer state
      setCurrentCustomer(matchedCustomer);
      setIsNewCustomer(isNew);
      
      // Note: We've moved the greeting functionality to the face detection logic
      // so we don't trigger it here anymore to avoid duplicate greetings
      console.log('Customer recognized, greeting will be handled by face detection process');
    }
  }, [currentCustomer]);
  
  // Define a function to manually trigger speech recognition
  const triggerSpeechRecognition = useCallback(() => {
    console.log('Manually triggering speech recognition');
    
    // Log the browser information for debugging
    console.log('Browser details:', 
      `${navigator.userAgent} - 
      Chrome: ${/Chrome/.test(navigator.userAgent)}, 
      Firefox: ${/Firefox/.test(navigator.userAgent)}, 
      Safari: ${/Safari/.test(navigator.userAgent)}`
    );
    
    // Make sure we're not speaking or processing
    if (isSpeaking) {
      console.log('Already speaking, stopping speech first');
      setIsSpeaking(false);
      setCurrentPhoneme("_");
    }
    
    // Set listening state to true
    setIsListening(true);
    
    // First try with the current ref
    if (speechRecognitionRef.current) {
      console.log('Speech recognition ref exists, starting listening');
      
    setTimeout(() => {
        speechRecognitionRef.current?.startListening();
      }, 100);
    } else {
      console.error('Speech recognition ref is null, cannot trigger manually');
      
      // Try again after a short delay in case the component is still initializing
      setTimeout(() => {
        if (speechRecognitionRef.current) {
          console.log('Delayed attempt to start speech recognition');
          speechRecognitionRef.current.startListening();
        } else {
          console.error('Speech recognition ref still null after delay');
        }
      }, 500);
    }
  }, [isSpeaking]);
  
  // Add a button to manually trigger speech recognition for testing
  useEffect(() => {
    // Add a debug key press handler to start speech recognition
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'm') {
        console.log('M key pressed, manually triggering speech recognition');
        triggerSpeechRecognition();
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [triggerSpeechRecognition]);
  
  // Handle volume change - use callback to prevent re-renders
  const handleVolumeChange = useCallback((volume: number) => {
    // Optional: could add volume visualization or logic here
    // console.log(`Microphone volume: ${volume}`);
    setVolume(volume);
  }, []);
  
  // Update microphone sensitivity
  const handleSensitivityChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    setMicSensitivity(value);
    
    // Update the sensitivity in the SpeechRecognition component
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.setMicrophoneSensitivity(value);
      console.log(`Mikrofon həssaslığı dəyişdirildi: ${value}`);
    }
  }, []);
  
  // Fonyeri səs-küydən təmizləmə parametrləri
  const [noiseReduction, setNoiseReduction] = useState<number>(0.2); // Arxa plan səsi azaltma dərəcəsi
  const [voiceBoost, setVoiceBoost] = useState<number>(1.5); // Səs gücləndirmə dərəcəsi

  // Arxa plan səs-küyü azaltma parametrlərini yeniləyən funksiya
  const updateNoiseReduction = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    setNoiseReduction(value);
    
    // Noise reduction parametrini SpeechRecognition komponentinə ötürürük
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.setNoiseReduction(value);
      console.log(`Arxa plan səs-küyü azaltma dərəcəsi: ${value}`);
    }
  }, []);

  // Səs gücləndirmə parametrlərini yeniləyən funksiya
  const updateVoiceBoost = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    setVoiceBoost(value);
    
    // Voice boost parametrini SpeechRecognition komponentinə ötürürük
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.setVoiceBoost(value);
      console.log(`Səs gücləndirmə dərəcəsi: ${value}`);
    }
  }, []);
  
  // Use the same video stream for both video elements (debug and UI)
  useEffect(() => {
    // Copy video stream from hidden debug element to visible UI element when stream is available
    const copyVideoStream = () => {
      try {
        const debugVideo = videoRef.current;
        const faceVideo = document.getElementById('faceVideo') as HTMLVideoElement | null;
        
        if (!debugVideo) {
          console.log('Debug video reference not available yet');
          return;
        }
        
        if (!faceVideo) {
          if (!window.faceVideoErrorLogged) {
            console.debug('Face video element not found, will retry...');
            window.faceVideoErrorLogged = true;
          }
          return;
        }
        
        if (!debugVideo.srcObject) {
          console.log('Debug video has no stream yet');
          return;
        }
        
        // Only set if not already set with the same stream
        if (faceVideo.srcObject !== debugVideo.srcObject) {
          console.log('Copying video stream to UI element');
          faceVideo.srcObject = debugVideo.srcObject;
          
          faceVideo.onloadedmetadata = () => {
            console.log('Face video got stream and metadata');
            faceVideo.play().catch(err => {
              console.error('Error playing face video:', err);
            });
          };
          
          faceVideo.onerror = (err) => {
            console.error('Face video element error:', err);
          };
        }
      } catch (error) {
        console.error('Error copying video stream:', error);
      }
    };
    
    // Try to copy stream immediately if available
    copyVideoStream();
    
    // Also set up an interval to try copying the stream multiple times
    // This helps in case the face video element isn't available immediately
    const streamCheckInterval = setInterval(() => {
      copyVideoStream();
    }, 1000);
    
    // Clean up interval
    return () => {
      clearInterval(streamCheckInterval);
    };
  }, [isModelLoaded]);
  
  // Watch videoRef.current.srcObject changes to update the face video
  useEffect(() => {
    const debugVideo = videoRef.current;
    if (debugVideo) {
      // Create a proxy object to detect when srcObject changes
      const originalSetter = Object.getOwnPropertyDescriptor(
        HTMLVideoElement.prototype, 'srcObject'
      )?.set;
      
      if (originalSetter) {
        Object.defineProperty(debugVideo, 'srcObject', {
          set(value) {
            originalSetter.call(this, value);
            console.log('Debug video srcObject changed, updating face video');
            
            // When debug video srcObject changes, update the face video too
            const faceVideo = document.getElementById('faceVideo') as HTMLVideoElement;
            if (faceVideo && value) {
              faceVideo.srcObject = value;
            }
          },
          get() {
            return this.getAttribute('srcObject');
          }
        });
      }
    }
  }, [videoRef.current]);

  // Initialize camera access on component mount
  useEffect(() => {
    // Function to request camera permissions explicitly before starting video
    const requestCameraPermission = async () => {
      try {
        // Try to get user media first to ensure permissions
        await navigator.mediaDevices.getUserMedia({ 
          video: true,
          audio: false 
        });
        console.log('Camera permission granted');
        return true;
      } catch (error) {
        console.error('Failed to get camera permission:', error);
        setCameraError("Kameraya icazə verilmədi. Zəhmət olmasa brauzerdə kamera icazələrini yoxlayın.");
        return false;
      }
    };

    // Only try to start video if permissions are granted and models are loaded
    const initCamera = async () => {
      if (await requestCameraPermission()) {
        if (isModelLoaded) {
          startVideo();
        }
      }
    };

    // Try to initialize camera
    initCamera();

    // Cleanup function
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          track.stop();
        });
      }
    };
  }, [isModelLoaded]);
  
  // Sync detected face with Scene3D when a customer is recognized
  useEffect(() => {
    if (currentCustomer && detectedFaceImage) {
      // Make sure the face is visible in Scene3D
      setFaceDetected(true);
      setDetectedFace(detectedFaceImage);
    }
  }, [currentCustomer, detectedFaceImage]);
  
  // Handle detected face appearance in top right corner and send greeting
  useEffect(() => {
    // Only run this effect when face is first detected and visible and greeting hasn't been sent yet
    if (faceDetected && detectedFace && !isSpeaking && !isProcessing && !hasGreetingSent) {
      console.log('Face detected and visible in top right corner, sending greeting message');
      
      // Mark greeting as sent to prevent duplicates
      setHasGreetingSent(true);
      
      // Default greeting message
      const greetingMessage = "Salam. Sizə necə kömək edə bilərəm?";
      
      // Set processing state
      setIsProcessing(true);
      
      // Send greeting to webhook
      (async () => {
        try {
          
          // İNDİ BURAYA ANALİZ METODUNU ÇAĞIRIRAN FUNKSİYAMIZI ƏLAVƏ EDİRİK
          console.log("🎯 ANALIZ METODU BURADA ÇAĞIRILIR - GREETING");
          
          // Hər yeni səs faylı üçün unikal nömrə generasiya edirik - bunu bir dəfə burada edək
          currentAnalysisNumber = ++audioFileCounter;
          console.log(`Greeting səs faylı №${currentAnalysisNumber} analiz edilməyə hazırlanır`);
          
          try {
            // Greeting mesajını JSON formatına çeviririk
            const jsonGreetingMessage = JSON.stringify({
              output: greetingMessage
            });
            
            // Məlumatı işləmə və konsola çap etmə
            console.log("%c 🤖 AI Salamlama (JSON):", "background: #9C27B0; color: white; padding: 5px; border-radius: 5px; font-weight: bold;", jsonGreetingMessage);
            
            // JSON formatında məlumatı ötürürük
            await parseAndSpeakResponse(jsonGreetingMessage);
          } catch (textError: any) {
            console.info('Mətn emalı xətası:', textError);
            console.error(`Mətn emalı xətası: ${textError.message || textError}`);
            setIsProcessing(false);
            setIsListening(true);
            if (speechRecognitionRef.current) {
              speechRecognitionRef.current.startListening();
            }
            handleWebhookFailure();
          }
        } catch (webhookError: any) {
          console.error('Error sending greeting to webhook:', webhookError);
          setIsProcessing(false);
          setIsListening(true);
          if (speechRecognitionRef.current) {
            speechRecognitionRef.current.startListening();
          }
        }
      })();
    }
  }, [faceDetected, detectedFace, isSpeaking, isProcessing, hasGreetingSent, handleWebhookFailure, parseAndSpeakResponse]);
  
  // Face detection interval with better tracking
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isModelLoaded && videoRef.current && canvasRef.current && !currentCustomer) {
      // Get references to video and canvas elements
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Skip if we're speaking or processing
      if (isSpeaking || isProcessing) {
        console.log('Speaking or processing, pausing face detection');
        return;
      }
      
      console.log('Starting improved face detection interval');
      
      // Track face detection status for capture timing
      let faceDetectedFrames = 0;
      const FRAMES_BEFORE_CAPTURE = 5; // Wait for 5 consecutive frames with face before capturing
      
      // Run faster interval (100ms) for more responsive tracking
      interval = setInterval(async () => {
        // Skip if video is not fully loaded
        if (video.readyState < 4 || video.videoWidth === 0 || video.videoHeight === 0) {
          return;
        }
        
        try {
          // Resize canvas to match video dimensions
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            console.log(`Canvas resized to ${canvas.width}x${canvas.height}`);
          }
          
          // Get canvas context for drawing
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          
          // Clear previous drawings
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Configure face detection for better accuracy
          const options = new faceapi.TinyFaceDetectorOptions({ 
            inputSize: 416, // Larger for better accuracy (must be multiple of 32)
            scoreThreshold: 0.5 // Minimum confidence
          });
          
          // Detect faces
          const results = await faceapi.detectAllFaces(video, options);
          
          if (results.length > 0) {
            // Face detected
            const detection = results[0];
            const box = detection.box;
            
            // No need to adjust coordinates as the canvas itself is mirrored with CSS
            // This keeps the detection math correct while the display handles the flipping
            
            // Add box size validation
            if (box.width < 40 || box.height < 40 || box.width/box.height > 2 || box.height/box.width > 2) {
              // Face size or ratio looks invalid
              faceDetectedFrames = 0;
              setIsFaceDetected(false);
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              return;
            }
            
            // Increment face detection counter
            faceDetectedFrames++;
            
            // Set status to detected
            setIsFaceDetected(true);
            
            // Calculate animation effect
            const time = Date.now() / 1000;
            const pulseWidth = 3 + Math.sin(time * 4) * 1.5; 
            const pulseOpacity = 0.6 + Math.sin(time * 4) * 0.2;
            
            // Draw semi-transparent backdrop overlay
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw frame highlight around face
            const padding = 15;
            
            // Clear face region
            ctx.clearRect(
              box.x - padding, 
              box.y - padding, 
              box.width + (padding * 2), 
              box.height + (padding * 2)
            );
            
            // Draw blue box around face
            ctx.strokeStyle = `rgba(0, 132, 255, ${pulseOpacity})`;
            ctx.lineWidth = pulseWidth;
            ctx.shadowColor = 'rgba(0, 132, 255, 0.8)';
            ctx.shadowBlur = 15;
            ctx.strokeRect(
              box.x - padding, 
              box.y - padding, 
              box.width + (padding * 2), 
              box.height + (padding * 2)
            );
            
            // Add label
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(0, 132, 255, 0.8)';
            ctx.fillRect(box.x - padding, box.y - padding - 30, box.width + (padding * 2), 30);
            ctx.font = 'bold 16px Arial';
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.fillText('Üz aşkarlandı', box.x - padding + (box.width + padding * 2) / 2, box.y - padding - 10);
            
            // Add corner brackets for aesthetics
            const cornerSize = 20;
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.9)';
            ctx.lineWidth = pulseWidth + 1;
            
            // Draw corners (top-left, top-right, bottom-left, bottom-right)
            const drawCorner = (x: number, y: number, dirX: number, dirY: number) => {
              ctx.beginPath();
              ctx.moveTo(x, y + dirY * cornerSize);
              ctx.lineTo(x, y);
              ctx.lineTo(x + dirX * cornerSize, y);
              ctx.stroke();
            };
            
            // Top left
            drawCorner(box.x - padding, box.y - padding, 1, 1);
            // Top right
            drawCorner(box.x + box.width + padding, box.y - padding, -1, 1);
            // Bottom left
            drawCorner(box.x - padding, box.y + box.height + padding, 1, -1);
            // Bottom right
            drawCorner(box.x + box.width + padding, box.y + box.height + padding, -1, -1);
            
            // Only capture face if we've detected it for several consecutive frames
            if (faceDetectedFrames >= FRAMES_BEFORE_CAPTURE) {
              // Only capture once when we hit the threshold
              if (faceDetectedFrames === FRAMES_BEFORE_CAPTURE) {
                console.log('Face detected consistently, capturing...');
                
                // Create a temporary canvas to extract just the face region
                const tempCanvas = document.createElement('canvas');
                const facePadding = Math.round(Math.min(box.width, box.height) * 0.2); // 20% padding
                
                tempCanvas.width = box.width + (facePadding * 2);
                tempCanvas.height = box.height + (facePadding * 2);
                
                const tempCtx = tempCanvas.getContext('2d');
                if (tempCtx) {
                  // Draw face with padding to temp canvas
                  tempCtx.drawImage(
                    video,
                    Math.max(0, box.x - facePadding),
                    Math.max(0, box.y - facePadding),
                    box.width + (facePadding * 2),
                    box.height + (facePadding * 2),
                    0, 0,
                    tempCanvas.width,
                    tempCanvas.height
                  );
                  
                  // Convert to data URL and update state
                  const faceImage = tempCanvas.toDataURL('image/jpeg', 0.92);
                  setDetectedFaceImage(faceImage);
                  
                  // Try to compute face descriptor and recognize customer
                  try {
                    const faceDescriptor = await faceapi.computeFaceDescriptor(video);
                    if (faceDescriptor) {
                      await recognizeCustomer(faceDescriptor as Float32Array, canvas);
                      
                      // Stop detection once customer is recognized
                      if (interval) {
                        clearInterval(interval);
                        interval = null;
                      }
                    }
                  } catch (descError) {
                    console.error('Error computing face descriptor:', descError);
                  }
                }
              }
            }
          } else {
            // No face detected
            faceDetectedFrames = 0;
            setIsFaceDetected(false);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Reset greeting state when face is lost
            if (hasGreetingSent) {
              console.log('Face lost, resetting greeting state');
              setHasGreetingSent(false);
            }
          }
        } catch (error) {
          console.error('Error in face detection cycle:', error);
        }
      }, 100); // 100ms for smoother tracking
      
      // Cleanup interval
      return () => {
        if (interval) {
          clearInterval(interval);
          console.log('Face detection interval cleared');
        }
      };
    }
  }, [isModelLoaded, currentCustomer, isSpeaking, isProcessing, recognizeCustomer, hasGreetingSent, parseAndSpeakResponse]);
  
  // Force face detected for testing
  useEffect(() => {
    console.log('Forcing face detection for testing');
    setTimeout(() => {
      setFaceDetected(true);
      setIsFaceDetected(true);
    }, 1000);
  }, []);
  
  // Bütün vəziyyətləri ilkin vəziyyətə qaytarmaq üçün funksiya
  const resetCustomerSession = useCallback(() => {
    console.log('Müştəri sessiyası sıfırlanır...');
    
    // Müştəri məlumatlarını sıfırla
    setCurrentCustomer(null);
    setReferenceCustomerFace(null);
    setIsNewCustomer(true);
    setHasGreetingSent(false);
    setUserSpeech('');
    setAiResponse('');
    setDetectedFaceImage(null);
    setFaceDetected(false);
    setIsFaceDetected(false);
    setMessages([]);
    
    // Nitq və səs vəziyyətlərini sıfırla
    setIsSpeaking(false);
    setIsListening(false);
    setIsProcessing(false);
    setCurrentPhoneme("_");
    
    // Aktivlik vaxtını yenilə
    setLastActiveTime(Date.now());
    
    console.log('Müştəri sessiyası uğurla sıfırlandı, yeni müştəri gözlənilir');
  }, []);

  // Müştəri aktivliyini izləmək üçün interval
  useEffect(() => {
    // Yalnız bir müştəri tanındıqda intervalı başlat
    if (currentCustomer && isModelLoaded && videoRef.current) {
      console.log('Müştəri aktivliyi izləmə intervalı başladıldı');
      
      // Müştəri ilk dəfə tanındıqda onun referans üz deskriptorunu yadda saxla
      if (!referenceCustomerFace && currentCustomer) {
        (async () => {
          try {
            // Cari video çərçivəsindən üz deskriptorunu hesabla
            const faceDescriptor = await faceapi.computeFaceDescriptor(videoRef.current as HTMLVideoElement);
            if (faceDescriptor) {
              setReferenceCustomerFace(faceDescriptor as Float32Array);
              console.log('Müştərinin referans üz deskriptoru yadda saxlanıldı');
              
              // Aktivlik vaxtını yenilə
              setLastActiveTime(Date.now());
            }
          } catch (error) {
            console.error('Referans üz deskriptorunu hesablama xətası:', error);
          }
        })();
      }
      
      // Hər 10 saniyədə bir müştəri aktivliyini yoxla
      const activityInterval = setInterval(async () => {
        const video = videoRef.current;
        
        if (!video || video.readyState < 4) {
          return; // Video hazır deyil
        }
        
        try {
          console.log('Müştəri aktivliyi yoxlanılır...');
          
          // Üz aşkarlama seçimləri
          const options = new faceapi.TinyFaceDetectorOptions({ 
            inputSize: 416,
            scoreThreshold: 0.5 
          });
          
          // Üzləri aşkarla
          const results = await faceapi.detectAllFaces(video, options);
          
          // Əgər heç bir üz aşkarlanmayıbsa
          if (results.length === 0) {
            console.log('Heç bir üz aşkarlanmadı, sessiya sıfırlanır');
            resetCustomerSession();
            return;
          }
          
          // Əgər üz aşkarlanıbsa və referans üz varsa, müqayisə et
          if (referenceCustomerFace) {
            const currentFaceDescriptor = await faceapi.computeFaceDescriptor(video);
            
            if (currentFaceDescriptor) {
              // Cari üz ilə referans üz arasındakı məsafəni hesabla
              const distance = faceapi.euclideanDistance(
                referenceCustomerFace, 
                currentFaceDescriptor as Float32Array
              );
              
              console.log('Üz müqayisəsi məsafəsi:', distance);
              
              // Əgər məsafə böyükdürsə, bu başqa bir müştəridir
              if (distance > 0.8) { // Eynilik eşik dəyəri
                console.log('Yeni müştəri aşkarlandı, sessiyanı sıfırlayıram');
                resetCustomerSession();
              } else {
                // Eyni müştəridir, aktivlik vaxtını yenilə
                setLastActiveTime(Date.now());
                console.log('Müştəri aktivliyi təsdiqləndi, aktivlik vaxtı yeniləndi');
              }
            }
          }
        } catch (error) {
          console.error('Müştəri aktivliyi yoxlama xətası:', error);
        }
      }, 15000); // Hər 15 saniyədə bir
      
      // Təmizləmə funksiyası
      return () => {
        clearInterval(activityInterval);
        console.log('Müştəri aktivliyi izləmə intervalı dayandırıldı');
      };
    }
  }, [currentCustomer, isModelLoaded, referenceCustomerFace, resetCustomerSession]);
  
  return (
    <div className="App">
      {/* Debug controls */}
      <div style={{ position: 'absolute', right: 10, bottom: 10, zIndex: 1000, display: 'flex', gap: '10px' }}>
        <button 
          onClick={triggerSpeechRecognition}
          style={{ 
            padding: '10px 15px', 
            background: '#0066cc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Mikrofonu Aktivləşdir
        </button>
        
        <button 
          onClick={startVideo}
          style={{ 
            padding: '10px 15px', 
            background: '#00aa44',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Kameranı Aktivləşdir
        </button>
      </div>
      
      {/* Camera debug info */}
      <div style={{ position: 'absolute', left: 10, bottom: 10, color: 'white', background: 'rgba(0,0,0,0.5)', padding: '10px', zIndex: 999, maxWidth: '300px', fontSize: '12px', borderRadius: '4px' }}>
        <p>Camera Status: {videoRef.current?.srcObject ? 'Active' : 'Inactive'}</p>
        <p>Camera Error: {cameraError || 'None'}</p>
        <p>Face Detected: {isFaceDetected ? 'Yes' : 'No'}</p>
        <p>Face Image: {detectedFaceImage ? 'Captured' : 'None'}</p>
      </div>
      
      {/* Main 3D Scene */}
      <Scene3D 
        isSpeaking={isSpeaking} 
        isListening={isListening}
        lipSyncValue={0} // We're using phoneme-based lip sync now
        isProcessing={isProcessing}
        detectedFace={detectedFaceImage}
        isFaceDetected={isFaceDetected}
        errorMessage={errorMessage}
        phoneme={currentPhoneme}
      />
      
      {/* Hidden video element for debugging - needed for face detection but not visible to user */}
      <video 
        id="debugVideo"
        ref={videoRef}
        autoPlay 
        playsInline 
        muted
        style={{ 
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          width: '320px',
          height: '240px'
        }}
        onLoadedMetadata={() => console.log('Debug video element loaded')}
        onError={(e) => {
          // Only log actual errors, not expected behavior
          if (process.env.NODE_ENV === 'development') {
            console.debug('Image loading issue - will retry');
          }
        }}
      />
      
      {/* Speech Recognition */}
      <SpeechRecognition
        ref={speechRecognitionRef}
        onResult={handleSpeechResult}
        onListeningChange={handleListeningChange}
        onVolumeChange={handleVolumeChange}
        autoStart={false}
        microphoneSensitivity={micSensitivity} // Həssaslıq ötürürük
      />
      
      {/* Interruption Handler */}
      <InterruptionHandler
        isSpeaking={isSpeaking}
        onInterrupt={handleInterruption}
      >
        {null}
      </InterruptionHandler>
      
      {/* Face recognition video - only shown when no customer is detected yet */}
      {isModelLoaded && !currentCustomer && (
      <div
        style={{ 
          position: 'absolute', 
            right: '50%',
            bottom: '20%',
            transform: 'translateX(50%)',
            width: '360px',
            height: '360px',
            opacity: isFaceDetected ? 0 : 1,
            visibility: isFaceDetected ? 'hidden' : 'visible',
            zIndex: 15,
            transition: 'all 0.8s ease-in-out',
          pointerEvents: 'none',
          border: '3px solid #0066cc',
            borderRadius: '12px',
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            background: 'rgba(0, 0, 0, 0.2)'
        }}
      >
        <video 
            id="faceVideo"
          autoPlay
          playsInline
          muted
          style={{ 
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '10px',
            transform: 'scaleX(-1)'
            }}
            onPlay={() => console.log('Face video is playing')}
        />
        
        <canvas 
          ref={canvasRef} 
          width="360" 
          height="360" 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            borderRadius: '10px',
            zIndex: 16,
            backgroundColor: 'transparent',
            pointerEvents: 'none',
            transform: 'scaleX(-1)'
          }}
        />

          {/* Dark overlay when face is not detected */}
          {!isFaceDetected && (
            <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                color: 'white',
                zIndex: 17,
                borderRadius: '10px',
                padding: '20px'
              }}
            >
              <div style={{ fontSize: '20px', fontWeight: 'bold', textAlign: 'center', marginBottom: '15px' }}>
                Üzünüzü kameraya göstərin
              </div>
              {cameraError && (
        <div style={{
                  color: '#ff6666', 
                  fontSize: '16px', 
                  textAlign: 'center',
                  marginTop: '10px',
                  padding: '10px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '5px',
                  maxWidth: '90%'
                }}>
                  {cameraError}
        </div>
              )}
      </div>
          )}
        </div>
      )}
      
      {/* Debug info - remove in production */}
      <div style={{ position: 'absolute', left: 10, top: 10, color: 'white', background: 'rgba(0,0,0,0.5)', padding: '10px' }}>
        <p>Speaking: {isSpeaking ? 'Yes' : 'No'}</p>
        <p>Listening: {isListening ? 'Yes' : 'No'}</p>
        <p>Processing: {isProcessing ? 'Yes' : 'No'}</p>
        <p>Face API Loaded: {isModelLoaded ? 'Yes' : 'No'}</p>
        <p>Customer ID: {currentCustomer?.id || 'None'}</p>
        <p>New customer: {isNewCustomer ? 'Yes' : 'No'}</p>
        <p>Sima User: {simaUserData ? `${simaUserData.firstName} ${simaUserData.lastName} (${simaUserData.sex})` : 'None'}</p>
        <p>Last speech: {userSpeech}</p>
        <p>Response: {aiResponse}</p>
      </div>
      
      {/* Chat Box */}
      <ChatBox
        messages={messages}
        inputMessage={inputMessage}
        setInputMessage={setInputMessage}
        handleSendMessage={handleSpeechResult}
        detectedText={detectedText}
        isSpeaking={isSpeaking}
        isListening={isListening}
        volume={volume}
      />
      
      {/* AudioAnalyzer komponentini əlavə edirik */}
      <AudioAnalyzer audioBlob={currentAudioBlob} isPlaying={isSpeaking} />
      
      {/* Add sensitivity control UI */}
      <div className="sensitivity-control" style={{ 
        position: 'fixed', 
        bottom: '10px', 
        right: '10px', 
        zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        padding: '10px',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        color: 'white',
        width: '220px'
      }}>
        <div style={{ marginBottom: '5px', fontSize: '12px' }}>Mikrofon həssaslığı: {micSensitivity.toFixed(1)}</div>
        <input
          type="range"
          min="1"
          max="10"
          step="0.5"
          value={micSensitivity}
          onChange={handleSensitivityChange}
          style={{ width: '100%' }}
        />
        
        <div style={{ marginTop: '10px', marginBottom: '5px', fontSize: '12px' }}>Səs-küy azaltma: {noiseReduction.toFixed(1)}</div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={noiseReduction}
          onChange={updateNoiseReduction}
          style={{ width: '100%' }}
        />
        
        <div style={{ marginTop: '10px', marginBottom: '5px', fontSize: '12px' }}>Səs gücləndirmə: {voiceBoost.toFixed(1)}</div>
        <input
          type="range"
          min="1"
          max="3"
          step="0.1"
          value={voiceBoost}
          onChange={updateVoiceBoost}
          style={{ width: '100%' }}
        />
        
        {volume > 0 && (
          <div className="volume-indicator" style={{
            width: '100%',
            height: '5px',
            background: '#444',
            marginTop: '10px',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${Math.min(100, volume / 2)}%`,
              background: volume > 50 ? '#ff5252' : '#4CAF50',
              transition: 'width 0.1s, background 0.3s'
            }}></div>
          </div>
        )}
      </div>
      
      <div className="video-container">
        <video ref={videoRef} className="video-element" />
        <canvas ref={canvasRef} className="canvas-overlay" />
      </div>
    </div>
  );
}

export default App;