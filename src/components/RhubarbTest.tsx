import React, { useState } from 'react';
import RhubarbLipSync from './RhubarbLipSync';

const RhubarbTest: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPhoneme, setCurrentPhoneme] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);
  const [file, setFile] = useState<File | null>(null);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      setFile(selectedFile);
      
      // Create object URL for the audio file
      const url = URL.createObjectURL(selectedFile);
      setAudioUrl(url);
    }
  };
  
  const handlePlay = () => {
    if (!audioUrl) {
      alert('Please select an audio file first.');
      return;
    }
    
    setIsPlaying(true);
  };
  
  const handleStop = () => {
    setIsPlaying(false);
    setCurrentPhoneme('');
  };
  
  const handlePhonemeChange = (phoneme: string) => {
    setCurrentPhoneme(phoneme);
    console.log(`Current phoneme: ${phoneme}`);
  };
  
  const handlePlaybackComplete = () => {
    setIsPlaying(false);
    setCurrentPhoneme('');
    console.log('Playback complete');
  };
  
  return (
    <div style={{ padding: '20px' }}>
      <h2>Rhubarb Lip Sync Test</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <input 
          type="file" 
          accept="audio/*" 
          onChange={handleFileChange} 
          disabled={isPlaying}
        />
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={handlePlay} 
          disabled={isPlaying || !audioUrl}
        >
          Play Audio
        </button>
        <button 
          onClick={handleStop} 
          disabled={!isPlaying}
          style={{ marginLeft: '10px' }}
        >
          Stop
        </button>
      </div>
      
      {currentPhoneme && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Current Phoneme: {currentPhoneme}</h3>
        </div>
      )}
      
      <RhubarbLipSync 
        audioUrl={audioUrl} 
        isPlaying={isPlaying}
        onPhonemeChange={handlePhonemeChange}
        onPlaybackComplete={handlePlaybackComplete}
      />
      
      <div style={{ marginTop: '20px' }}>
        <p><strong>Console Output:</strong> Open your browser's console to see phoneme timing logs.</p>
      </div>
    </div>
  );
};

export default RhubarbTest; 