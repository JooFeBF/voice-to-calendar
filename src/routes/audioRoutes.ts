import express, { Request, Response, NextFunction } from 'express';
import { StreamStorageService } from '../services';
import { Config } from '../config';
import logger from '../utils/logger';

export function createAudioRoutes(storageService: StreamStorageService, config: Config) {
  const router = express.Router();

  router.post('/upload-stream', async (req: Request, res: Response, next: NextFunction) => {
    const eventId = storageService.generateEventId();
    const writeStream = storageService.createWriteStream(eventId);

    storageService.setStatus(eventId, { status: 'processing' });

    let receivedBytes = 0;

    req.on('data', (chunk: Buffer) => {
      receivedBytes += chunk.length;
      writeStream.write(chunk);
    });

    req.on('end', () => {
      writeStream.end();
      logger.info('Audio upload complete', { eventId, bytesReceived: receivedBytes });
      
      res.status(200).json({
        success: true,
        eventId,
        bytesReceived: receivedBytes
      });
    });

    req.on('error', (error: Error) => {
      logger.error('Upload error', { eventId, error: error.message });
      writeStream.end();
      storageService.setStatus(eventId, {
        status: 'error',
        error: error.message
      });
      next(error);
    });

    writeStream.on('error', (error: Error) => {
      logger.error('Write stream error', { eventId, error: error.message });
      storageService.setStatus(eventId, {
        status: 'error',
        error: error.message
      });
      next(error);
    });
  });

  router.get('/status/:eventId', async (req: Request, res: Response, next: NextFunction) => {
    const { eventId } = req.params;
    const timeoutParam = req.query.timeout as string;
    const timeout = timeoutParam ? parseInt(timeoutParam, 10) : config.statusPollTimeout;

    try {
      const status = await storageService.waitForStatus(eventId, timeout);
      res.status(200).json(status);
    } catch (error) {
      const currentStatus = storageService.getStatus(eventId);
      if (currentStatus) {
        res.status(200).json(currentStatus);
      } else {
        res.status(404).json({
          status: 'error',
          error: 'Event not found'
        });
      }
    }
  });

  router.get('/download/:eventId', (req: Request, res: Response, next: NextFunction) => {
    const { eventId } = req.params;
    logger.info('Audio download request', { eventId });
    
    const status = storageService.getStatus(eventId);
    logger.debug('Status lookup result', { 
      eventId,
      status: status ? status.status : 'null',
      hasAudioPath: status ? !!status.audioPath : false,
      audioPath: status?.audioPath
    });

    if (!status) {
      logger.warn('Event not found for download', { eventId });
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    if (status.status === 'processing') {
      logger.info('Audio still processing', { eventId });
      res.status(202).json({ message: 'Audio still processing' });
      return;
    }

    if (status.status === 'error') {
      logger.error('Error status for download', { eventId, error: status.error });
      res.status(500).json({ error: status.error });
      return;
    }

    if (!status.audioPath) {
      logger.warn('No audioPath in status', { eventId, status });
      res.status(404).json({ error: 'Audio file not found' });
      return;
    }

    if (!storageService.fileExists(status.audioPath)) {
      logger.error('Audio file does not exist', { eventId, audioPath: status.audioPath });
      res.status(404).json({ error: 'Audio file not found' });
      return;
    }

    logger.info('Serving audio file', { eventId, audioPath: status.audioPath });

    const mimeType = config.audioOutputFormat === '.wav' ? 'audio/wav' 
      : config.audioOutputFormat === '.mp3' ? 'audio/mpeg'
      : config.audioOutputFormat === '.ogg' ? 'audio/ogg'
      : config.audioOutputFormat === '.aac' ? 'audio/aac'
      : config.audioOutputFormat === '.flac' ? 'audio/flac'
      : 'audio/wav';

    const fileExtension = config.audioOutputFormat.startsWith('.') 
      ? config.audioOutputFormat.slice(1) 
      : config.audioOutputFormat;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${eventId}.${fileExtension}"`);

    const readStream = storageService.createReadStream(status.audioPath);

    readStream.on('error', (error: Error) => {
      logger.error('Read stream error', { eventId, error: error.message });
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to read audio file' });
      }
    });

    readStream.pipe(res);
  });

  return router;
}
