import express, { Request, Response, NextFunction } from 'express';
import { GoogleAuth, AuthClient } from 'google-auth-library';
import { getConfig } from './config';
import { AudioToCalendarController } from './controllers';
import { StreamStorageService } from './services';
import { createAudioRoutes } from './routes/audioRoutes';
import dotenv from 'dotenv';
import logger, { createRequestLogger } from './utils/logger';

dotenv.config();

async function authorize(): Promise<AuthClient> {
  const config = getConfig();
  logger.info('Initializing Google Calendar authentication', {
    serviceAccountPath: config.googleServiceAccountPath
  });
  
  const auth = new GoogleAuth({
    keyFile: config.googleServiceAccountPath,
    scopes: ['https://www.googleapis.com/auth/calendar']
  });

  try {
    const client = await auth.getClient();
    logger.info('Google Calendar authentication successful');
    return client;
  } catch (error) {
    logger.error('Google Calendar authentication failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

async function startServer(): Promise<void> {
  const config = getConfig();
  const app = express();

  logger.info('Starting Audio-to-Calendar server', {
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info'
  });

  const auth = await authorize();
  const controller = new AudioToCalendarController(
    config.openaiApiKey,
    auth,
    config.calendarEmail,
    config.audioInputFormat,
    config.audioOutputFormat
  );

  const storageService = new StreamStorageService(
    config.tempStorageDir,
    config.audioInputFormat,
    config.audioOutputFormat
  );

  logger.info('Services initialized', {
    tempStorageDir: config.tempStorageDir,
    audioInputFormat: config.audioInputFormat,
    audioOutputFormat: config.audioOutputFormat,
    calendarEmail: config.calendarEmail
  });

  app.use(express.json({ limit: config.maxUploadSize }));
  
  // Add request logging middleware
  app.use(createRequestLogger());

  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const audioRoutes = createAudioRoutes(storageService, config);
  app.use('/api/audio', audioRoutes);

  // Endpoint to poll for currently occurring events and generate audio on-demand
  app.get('/api/events/current', async (req: Request, res: Response, next: NextFunction) => {
    logger.info('Checking for currently occurring events');

    try {
      const now = new Date();
      const timeMin = now.toISOString();
      const timeMax = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour window

      // Get events from calendar that are currently occurring
      const events = await controller.calendarService.listEvents(timeMin, timeMax, 10);

      // Filter for events that are currently occurring (now >= start && now <= end)
      const currentEvents = events.filter(event => {
        if (!event.start?.dateTime || !event.end?.dateTime) return false;
        const eventStart = new Date(event.start.dateTime);
        const eventEnd = new Date(event.end.dateTime);
        return now >= eventStart && now <= eventEnd;
      });

      if (currentEvents.length === 0) {
        logger.info('No events currently occurring');
        res.status(200).json({
          hasPending: false,
          message: 'No events currently occurring'
        });
        return;
      }

      // Process the first currently occurring event
      const event = currentEvents[0];
      logger.info('Found currently occurring event', {
        eventId: event.id,
        title: event.summary,
        start: event.start?.dateTime,
        end: event.end?.dateTime
      });

      // Generate audio for this event on-demand
      const tempEventId = `poll_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const outputPath = storageService.getOutputAudioPath(tempEventId);

      const audioResult = await controller.generateEventAudioAndDelete(
        event.id as string,
        outputPath
      );

      if (audioResult.success && audioResult.audioPath) {
        // Store the audio path with the calendar event ID
        storageService.setStatus(tempEventId, {
          status: 'ready',
          audioPath: audioResult.audioPath,
          eventId: event.id as string
        });

        logger.info('Audio generated for currently occurring event', {
          calendarEventId: event.id,
          audioPath: audioResult.audioPath
        });

        res.status(200).json({
          hasPending: true,
          eventId: tempEventId, // Return temp event ID for download
          calendarEventId: event.id,
          title: event.summary,
          start: event.start?.dateTime,
          end: event.end?.dateTime
        });
      } else {
        logger.error('Failed to generate audio for current event', {
          eventId: event.id,
          error: audioResult.error
        });

        res.status(500).json({
          hasPending: false,
          error: audioResult.error || 'Failed to generate audio for current event'
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error checking for current events', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json({
        hasPending: false,
        error: errorMessage
      });
    }
  });

  app.post('/api/audio/process/:eventId', async (req: Request, res: Response, next: NextFunction) => {
    const { eventId } = req.params;
    
    logger.info('Processing audio request', { eventId });

    try {
      const inputPath = storageService.getInputAudioPath(eventId);
      const outputPath = storageService.getOutputAudioPath(eventId);

      if (!storageService.fileExists(inputPath)) {
        logger.warn('Input audio file not found', { eventId, inputPath });
        res.status(404).json({ error: 'Input audio file not found' });
        return;
      }

      logger.debug('Processing audio file', { eventId, inputPath });
      const result = await controller.processAudioFile(inputPath);

      if (!result.success) {
        storageService.setStatus(eventId, {
          status: 'error',
          error: result.error || 'Failed to process audio'
        });

        logger.error('Failed to process audio', {
          eventId,
          error: result.error
        });

        res.status(500).json({
          success: false,
          error: result.error || 'Failed to process audio'
        });
        return;
      }

      // Handle "no_action" case - event already exists, no action needed
      if (result.operation === 'no_action') {
        storageService.setStatus(eventId, {
          status: 'no_action',
          reason: result.eventDetails?.description || 'Event already exists'
        });

        logger.info('No action needed - event already exists', {
          eventId,
          reason: result.eventDetails?.description
        });

        res.status(200).json({
          success: true,
          eventId,
          operation: 'no_action',
          message: result.eventDetails?.description || 'Event already exists',
          audioReady: false
        });
        return;
      }

      // Handle successful operations that created/updated/deleted an event
      if (result.calendarEvent) {
        logger.info('Audio processed successfully, event created/updated', {
          eventId,
          calendarEventId: result.calendarEvent.id,
          operation: result.operation
        });

        // Store the calendar event ID for later polling
        storageService.setStatus(eventId, {
          status: 'ready',
          eventId: result.calendarEvent.id as string
        });

        res.status(200).json({
          success: true,
          eventId,
          calendarEventId: result.calendarEvent.id,
          operation: result.operation,
          eventDetails: result.eventDetails,
          message: 'Event processed successfully. Poll /api/events/current to get audio when event is occurring.'
        });
      } else {
        // This shouldn't happen, but handle it gracefully
        storageService.setStatus(eventId, {
          status: 'error',
          error: 'Processing succeeded but no calendar event was returned'
        });

        logger.error('Processing succeeded but no calendar event returned', {
          eventId,
          operation: result.operation
        });

        res.status(500).json({
          success: false,
          error: 'Processing succeeded but no calendar event was returned'
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error processing audio request', {
        eventId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });

      storageService.setStatus(eventId, {
        status: 'error',
        error: errorMessage
      });

      next(error);
    }
  });

  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method
    });
    
    res.status(500).json({
      error: err.message || 'Internal server error'
    });
  });

  app.listen(config.serverPort, config.serverHost, () => {
    logger.info('Server started successfully', {
      host: config.serverHost,
      port: config.serverPort,
      healthCheck: `http://${config.serverHost}:${config.serverPort}/health`
    });
    console.log(`Server running on http://${config.serverHost}:${config.serverPort}`);
    console.log(`Health check: http://${config.serverHost}:${config.serverPort}/health`);
  });
}

startServer().catch((error) => {
  logger.error('Fatal error during server startup', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  console.error('Fatal error:', error);
  process.exit(1);
});

export async function generateEventAudio(eventId: string, outputPath: string): Promise<{ success: boolean; audioPath?: string; error?: string }> {
  const config = getConfig();

  const auth = await authorize();
  const controller = new AudioToCalendarController(
    config.openaiApiKey,
    auth,
    config.calendarEmail,
    config.audioInputFormat,
    config.audioOutputFormat
  );

  return await controller.generateEventAudioAndDelete(eventId, outputPath);
}
