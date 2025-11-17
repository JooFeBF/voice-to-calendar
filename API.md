# ESP32 Audio Streaming API

This server implements the HTTP streaming endpoints for the ESP32 audio calendar assistant.

## Endpoints

### POST /api/audio/upload-stream
Upload audio from ESP32 via chunked transfer encoding.

**Request:**
- Method: POST
- Content-Type: audio/wav
- Body: Raw audio stream (chunked)

**Response:**
```json
{
  "success": true,
  "eventId": "evt_1234567890_abc123",
  "bytesReceived": 245760
}
```

### GET /api/audio/status/:eventId
Check processing status with long-polling support.

**Request:**
- Method: GET
- URL Params: `eventId` - Event identifier from upload
- Query Params: `timeout` - Optional timeout in ms (default: 30000)

**Response (Processing):**
```json
{
  "status": "processing"
}
```

**Response (Ready):**
```json
{
  "status": "ready",
  "audioPath": "/path/to/output.wav",
  "eventId": "calendar_event_id"
}
```

**Response (Error):**
```json
{
  "status": "error",
  "error": "Error message"
}
```

### GET /api/audio/download/:eventId
Download processed audio response.

**Request:**
- Method: GET
- URL Params: `eventId` - Event identifier from upload

**Response:**
- Content-Type: audio/wav
- Content-Disposition: attachment; filename="evt_xxx.wav"
- Body: Audio stream

### POST /api/audio/process/:eventId
Trigger audio processing for uploaded event.

**Request:**
- Method: POST
- URL Params: `eventId` - Event identifier from upload

**Response:**
```json
{
  "success": true,
  "eventId": "evt_1234567890_abc123",
  "calendarEventId": "google_calendar_event_id",
  "audioReady": true
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-17T12:00:00.000Z"
}
```

## Usage Flow

1. ESP32 records audio and streams to `/api/audio/upload-stream`
2. Server responds with `eventId`
3. Server (or client) triggers `/api/audio/process/:eventId`
4. ESP32 polls `/api/audio/status/:eventId` until status is "ready"
5. ESP32 downloads audio from `/api/audio/download/:eventId`
6. ESP32 plays audio response

## Configuration

Set environment variables in `.env`:

```bash
SERVER_PORT=3000
SERVER_HOST=0.0.0.0
TEMP_STORAGE_DIR=./temp
OPENAI_API_KEY=your_key
GOOGLE_SERVICE_ACCOUNT_PATH=./calendar.json
CALENDAR_EMAIL=your_calendar@gmail.com
AUDIO_INPUT_FORMAT=.wav
AUDIO_OUTPUT_FORMAT=.wav
```

## Running

```bash
npm run build
npm run server
```

Development mode:
```bash
npm run dev:server
```
