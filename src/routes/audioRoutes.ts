import express, { Request, Response, NextFunction } from 'express';
import { StreamStorageService } from '../services';
import { Config } from '../config';

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
      console.log(`Audio upload complete: ${eventId}, ${receivedBytes} bytes`);
      
      res.status(200).json({
        success: true,
        eventId,
        bytesReceived: receivedBytes
      });
    });

    req.on('error', (error: Error) => {
      console.error('Upload error:', error);
      writeStream.end();
      storageService.setStatus(eventId, {
        status: 'error',
        error: error.message
      });
      next(error);
    });

    writeStream.on('error', (error: Error) => {
      console.error('Write stream error:', error);
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
    const status = storageService.getStatus(eventId);

    if (!status) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    if (status.status === 'processing') {
      res.status(202).json({ message: 'Audio still processing' });
      return;
    }

    if (status.status === 'error') {
      res.status(500).json({ error: status.error });
      return;
    }

    if (!status.audioPath || !storageService.fileExists(status.audioPath)) {
      res.status(404).json({ error: 'Audio file not found' });
      return;
    }

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
      console.error('Read stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to read audio file' });
      }
    });

    readStream.pipe(res);
  });

  return router;
}
