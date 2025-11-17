# Environment Variables Usage

All hardcoded values have been replaced with environment variables from `.env` file.

## Configuration Variables

### Audio Settings
- `AUDIO_INPUT_FORMAT` - Format for uploaded audio (e.g., `.ogg`, `.wav`)
- `AUDIO_OUTPUT_FORMAT` - Format for generated audio responses (e.g., `.wav`, `.mp3`)

### Server Settings
- `SERVER_PORT` - Port number for the server (default: 3000)
- `SERVER_HOST` - Host address for the server (default: 0.0.0.0)
- `TEMP_STORAGE_DIR` - Directory for temporary audio files (default: ./temp)
- `STATUS_POLL_TIMEOUT` - Timeout in milliseconds for status polling (default: 30000)
- `MAX_UPLOAD_SIZE` - Maximum upload size for audio files (default: 50mb)

### API Keys & Credentials
- `OPENAI_API_KEY` - OpenAI API key for transcription and TTS
- `GOOGLE_SERVICE_ACCOUNT_PATH` - Path to Google service account JSON
- `CALENDAR_EMAIL` - Google Calendar email address

## Changes Made

### 1. Config (`src/config/index.ts`)
Added new configuration properties:
- `statusPollTimeout: number` - Replaces hardcoded 30000ms
- `maxUploadSize: string` - Replaces hardcoded '50mb'

### 2. StreamStorageService (`src/services/StreamStorageService.ts`)
Now accepts audio format parameters:
```typescript
constructor(
  storageDir: string, 
  inputFormat: string = '.wav', 
  outputFormat: string = '.wav'
)
```
- Automatically adds file extensions to audio files based on format
- `getInputAudioPath()` uses `inputFormat`
- `getOutputAudioPath()` uses `outputFormat`

### 3. Audio Routes (`src/routes/audioRoutes.ts`)
Now accepts config parameter:
```typescript
createAudioRoutes(storageService: StreamStorageService, config: Config)
```
- Status endpoint timeout uses `config.statusPollTimeout`
- Download endpoint MIME type is determined from `config.audioOutputFormat`:
  - `.wav` → `audio/wav`
  - `.mp3` → `audio/mpeg`
  - `.ogg` → `audio/ogg`
  - `.aac` → `audio/aac`
  - `.flac` → `audio/flac`
- File extension in Content-Disposition header uses `config.audioOutputFormat`

### 4. Server (`src/server.ts`)
- `StreamStorageService` now initialized with audio formats from config
- `express.json()` limit uses `config.maxUploadSize`
- `createAudioRoutes()` receives config parameter

## Example .env File

```bash
OPENAI_API_KEY=your_key_here
GOOGLE_SERVICE_ACCOUNT_PATH=./calendar.json
AUDIO_FILE_PATH=./audio.ogg
CALENDAR_EMAIL=your_email@gmail.com
AUDIO_INPUT_FORMAT=.ogg
AUDIO_OUTPUT_FORMAT=.wav
SERVER_PORT=3000
SERVER_HOST=0.0.0.0
TEMP_STORAGE_DIR=./temp
STATUS_POLL_TIMEOUT=30000
MAX_UPLOAD_SIZE=50mb
```

## Benefits

✅ **No hardcoded values** - All configuration through environment variables
✅ **Flexible audio formats** - Easy to change input/output formats without code changes
✅ **Dynamic MIME types** - Automatically sets correct Content-Type based on output format
✅ **Configurable timeouts** - Adjust polling timeout without recompiling
✅ **Adjustable limits** - Change upload size limits via environment variables
