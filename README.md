# Branch Assistant

Branch Assistant is a 3D virtual assistant application that uses face recognition, speech recognition, and AI to provide an interactive banking experience.

## Features

- 3D character (Ayla) displayed from chest up
- Face recognition to identify returning customers
- Speech recognition to capture customer queries
- Realistic character animations and expressions
- Lip sync functionality for natural speech
- Customer memory system to remember conversations
- Loading indicator during processing
- Interruption handling for natural conversation flow
- Bank branch background setting

## Prerequisites

- Node.js 16+ and npm
- Modern web browser with WebGL support
- Camera access for face recognition
- Microphone access for speech recognition

## Installation

1. Clone or extract this repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with your API keys (see `.env.example` for reference)

## Running Locally

To start the development server:

```bash
npm start
```

This will run the app in development mode. Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

## Building for Production

To build the app for production:

```bash
npm run build
```

This creates an optimized production build in the `build` folder.

## Docker Deployment

The project includes Docker configuration for easy deployment:

```bash
# Build and run with Docker
./build-and-run.sh
```

Or manually:

```bash
docker-compose build
docker-compose up -d
```

## Project Structure

- `/public/models/` - 3D model and face recognition models
- `/public/images/` - Background images
- `/src/components/` - React components
  - `Character.tsx` - 3D character with animations
  - `Scene3D.tsx` - 3D scene setup
  - `SpeechRecognition.tsx` - Speech recognition
  - `CustomerMemory.tsx` - Customer data storage
  - `InterruptionHandler.tsx` - Speech interruption detection
  - `LipSync.tsx` - Lip synchronization
  - `LoadingIndicator.tsx` - Processing indicator

## Troubleshooting

- **Camera access issues**: Ensure your browser has permission to access the camera
- **Microphone access issues**: Ensure your browser has permission to access the microphone
- **3D rendering issues**: Check that WebGL is enabled in your browser

## License

This project is proprietary and confidential.

## Contact

For support or inquiries, please contact the development team.
  
npx gltfjsx public/models/Ayla20.glb -o src/components/Character.tsx -r public
