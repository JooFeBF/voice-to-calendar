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

      if (result.success && result.calendarEvent) {
        logger.info('Audio processed successfully, generating event audio', {
          eventId,
          calendarEventId: result.calendarEvent.id,
          operation: result.operation
        });

        const audioResult = await controller.generateEventAudioAndDelete(
          result.calendarEvent.id as string,
          outputPath
        );

        if (audioResult.success && audioResult.audioPath) {
          storageService.setStatus(eventId, {
            status: 'ready',
            audioPath: audioResult.audioPath,
            eventId: result.calendarEvent.id as string
          });

          logger.info('Event audio generated successfully', {
            eventId,
            calendarEventId: result.calendarEvent.id,
            audioPath: audioResult.audioPath
          });

          res.status(200).json({
            success: true,
            eventId,
            calendarEventId: result.calendarEvent.id,
            audioReady: true
          });
        } else {
          storageService.setStatus(eventId, {
            status: 'error',
            error: audioResult.error || 'Failed to generate audio'
          });

          logger.error('Failed to generate event audio', {
            eventId,
            error: audioResult.error
          });

          res.status(500).json({
            success: false,
            error: audioResult.error || 'Failed to generate audio'
          });
        }
      } else {
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
