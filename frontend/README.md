# Audio Calendar Frontend

A modern React frontend for the Audio-to-Calendar voice assistant. This application allows users to record voice commands by pressing and holding a button, and automatically plays audio reminders when calendar events occur.

## Features

- 🎙️ **Voice Recording**: Press and hold the button to record voice commands
- 🔊 **Audio Playback**: Automatically plays audio reminders for calendar events
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🎨 **Beautiful UI**: Modern gradient design with smooth animations
- 🔔 **Real-time Polling**: Continuously checks for upcoming events
- ⚡ **Streaming**: Audio is streamed to/from the server for optimal performance

## Prerequisites

- Node.js 18+ and npm
- Backend server running on `http://localhost:3000`

## Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

## Running the Application

### Development Mode

Start the development server with hot reload:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Production Build

Build the application for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Usage

### Recording Voice Commands

1. **Grant Permissions**: When you first open the app, grant microphone permissions
2. **Press and Hold**: Touch and hold the button to start recording
3. **Release**: Release the button to stop recording and send to server
4. **Wait**: The audio will be processed and the event will be created

### Receiving Reminders

- The app automatically polls the server every 5 seconds
- When a calendar event is occurring, it will:
  - Show a "Recordatorio pendiente detectado" message
  - Automatically play the audio reminder
  - Display "Reproduciendo recordatorio..." on the button

### Button States

- **Default**: "Mantén presionado para recordar" (white background)
- **Recording**: "Grabando..." with blinking text (gradient pink/red background)
- **Processing**: "Procesando..." with spinner (gradient blue background)
- **Playing**: "Reproduciendo recordatorio..." with audio waves (disabled)

## Configuration

The frontend communicates with the backend through a proxy configured in `vite.config.ts`:

```typescript
proxy: {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  }
}
```

To change the backend URL, modify the `target` in `vite.config.ts`.

## API Integration

The frontend uses these backend endpoints:

- `POST /api/audio/upload-stream` - Upload recorded audio
- `POST /api/audio/process/:eventId` - Process uploaded audio
- `GET /api/events/current` - Poll for current events
- `GET /api/audio/download/:eventId` - Download audio reminders

## Browser Compatibility

Requires a modern browser with support for:
- MediaRecorder API (for recording)
- Web Audio API (for playback)
- getUserMedia API (for microphone access)

Tested on:
- Chrome/Edge 88+
- Firefox 87+
- Safari 14.1+

## Permissions

The app requires the following permissions:
- **Microphone**: For recording voice commands
- **Audio Playback**: For playing reminders (usually granted by default)

## Troubleshooting

### No Audio Recording

- Check microphone permissions in browser settings
- Ensure you're using HTTPS or localhost (required for getUserMedia)
- Try refreshing the page and granting permissions again

### Audio Not Playing

- Check browser audio settings
- Ensure the backend server is running
- Check browser console for errors

### Connection Issues

- Verify the backend server is running on port 3000
- Check the proxy configuration in `vite.config.ts`
- Look for CORS issues in the browser console

## Development

### Project Structure

```
frontend/
├── src/
│   ├── hooks/
│   │   ├── useAudioRecorder.ts  # Audio recording logic
│   │   ├── useEventPoller.ts    # Event polling logic
│   │   └── useAudioPlayer.ts    # Audio playback logic
│   ├── App.tsx                   # Main application component
│   ├── App.css                   # Application styles
│   ├── main.tsx                  # Application entry point
│   └── index.css                 # Global styles
├── index.html                    # HTML template
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
└── vite.config.ts               # Vite config
```

### Custom Hooks

#### useAudioRecorder

Manages audio recording and streaming to the server:
- Requests microphone permissions
- Records audio using MediaRecorder API
- Uploads audio chunks to server
- Triggers audio processing

#### useEventPoller

Polls the server for calendar events:
- Checks for current events every 5 seconds
- Only polls when not recording
- Detects new events and triggers playback

#### useAudioPlayer

Handles audio playback using Web Audio API:
- Fetches audio from server
- Decodes and plays audio
- Manages playback state

## License

ISC


