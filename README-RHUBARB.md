# Rhubarb Lip Sync Integration with React

This project integrates [Rhubarb Lip Sync](https://github.com/DanielSWolf/rhubarb-lip-sync) with a React application to generate phoneme timing data for audio files. The phoneme data can be used for character animation and lip syncing.

## Features

- Upload and process audio files to get phoneme timing data
- Display real-time phoneme changes in the UI
- Log detailed phoneme timing data to the console
- Fallback to mock data when Rhubarb is not available

## Setup

### Prerequisites

- Node.js and npm
- Rhubarb Lip Sync (optional, but recommended for production use)

### Installing Rhubarb Lip Sync

To use the actual Rhubarb phoneme extraction (instead of mock data), you need to install Rhubarb Lip Sync:

1. Download from the [official GitHub repository](https://github.com/DanielSWolf/rhubarb-lip-sync/releases)
2. Install according to the instructions for your OS
3. Make sure the `rhubarb` command is available in your PATH

### Starting the Application

1. Install dependencies:
   ```
   npm install
   ```

2. Start both the React app and backend server:
   ```
   npm run dev
   ```

3. Open the application in your browser at `http://localhost:3000`

## Usage

1. Click the "Show Rhubarb Test" button in the top-right corner of the application
2. In the Rhubarb test panel, upload an audio file (WAV format works best)
3. Click "Play Audio" to process the audio and see the phoneme data
4. Check your browser console to see the detailed phoneme timing logs

## How It Works

1. The frontend sends the audio file to the backend server
2. The server processes the audio using Rhubarb Lip Sync (or generates mock data if Rhubarb is not available)
3. Phoneme timing data is returned to the frontend
4. The frontend logs the phoneme data to the console and updates the UI in real-time

## Phoneme Types

Rhubarb uses the following phoneme types:

- `A`: Open mouth (as in "cat") 
- `B`: Slightly open mouth (as in "pet")
- `C`: Closed mouth (as in "map")
- `D`: Round mouth (as in "dog")
- `E`: Small mouth (as in "sheep")
- `F`: Affricative (as in "fish")
- `G`: Voiced L (as in "luck")
- `H`: Voiced TH (as in "that")
- `X`: Idle position (silent)

## Integration with Character Animation

To use the phoneme data for character animation:

1. Use the `onPhonemeChange` callback to receive phoneme updates
2. Map each phoneme to a specific mouth shape or animation
3. Apply the animation to your character model

Example:

```jsx
const handlePhonemeChange = (phoneme) => {
  switch(phoneme) {
    case 'A': setMouthShape('open'); break;
    case 'B': setMouthShape('slight'); break;
    case 'C': setMouthShape('closed'); break;
    // ...other phonemes
    default: setMouthShape('idle');
  }
};

// Then in your component:
<RhubarbLipSync 
  audioUrl={audioUrl} 
  isPlaying={isPlaying}
  onPhonemeChange={handlePhonemeChange}
/>
```

## Troubleshooting

- If you see "Error processing audio with Rhubarb" in the console, make sure Rhubarb is installed correctly
- If you're getting mock data instead of actual phoneme data, check that the Rhubarb executable is in your PATH
- For audio format issues, convert your audio to WAV format for best compatibility

## Technical Details

- The frontend is built with React and TypeScript
- The backend server uses Express.js
- The phoneme timing data is processed using Rhubarb Lip Sync or generated as mock data
- The component's design allows for easy integration with any character animation system 