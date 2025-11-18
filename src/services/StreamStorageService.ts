import fs from 'fs';
import path from 'path';

interface AudioProcessingStatus {
  status: 'processing' | 'ready' | 'error' | 'no_action';
  audioPath?: string;
  error?: string;
  eventId?: string;
  reason?: string;
}

export class StreamStorageService {
  private storageDir: string;
  private inputFormat: string;
  private outputFormat: string;
  private statusMap: Map<string, AudioProcessingStatus>;
  private statusWaiters: Map<string, Array<(status: AudioProcessingStatus) => void>>;

  constructor(storageDir: string, inputFormat: string = '.wav', outputFormat: string = '.wav') {
    this.storageDir = storageDir;
    this.inputFormat = inputFormat.startsWith('.') ? inputFormat : `.${inputFormat}`;
    this.outputFormat = outputFormat.startsWith('.') ? outputFormat : `.${outputFormat}`;
    this.statusMap = new Map();
    this.statusWaiters = new Map();

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  getInputAudioPath(eventId: string, customFormat?: string): string {
    const format = customFormat || this.inputFormat;
    return path.join(this.storageDir, `${eventId}_input${format}`);
  }

  getStorageDir(): string {
    return this.storageDir;
  }

  getOutputAudioPath(eventId: string): string {
    return path.join(this.storageDir, `${eventId}_output${this.outputFormat}`);
  }

  createWriteStream(eventId: string): fs.WriteStream {
    const inputPath = this.getInputAudioPath(eventId);
    return fs.createWriteStream(inputPath);
  }

  setStatus(eventId: string, status: AudioProcessingStatus): void {
    this.statusMap.set(eventId, status);

    const waiters = this.statusWaiters.get(eventId);
    if (waiters) {
      waiters.forEach(resolve => resolve(status));
      this.statusWaiters.delete(eventId);
    }
  }

  getStatus(eventId: string): AudioProcessingStatus | undefined {
    return this.statusMap.get(eventId);
  }

  async waitForStatus(eventId: string, timeoutMs: number = 30000): Promise<AudioProcessingStatus> {
    const currentStatus = this.statusMap.get(eventId);
    
    if (currentStatus && currentStatus.status !== 'processing') {
      return currentStatus;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const waiters = this.statusWaiters.get(eventId);
        if (waiters) {
          const index = waiters.indexOf(resolve);
          if (index > -1) {
            waiters.splice(index, 1);
          }
        }
        reject(new Error('Status check timeout'));
      }, timeoutMs);

      const wrappedResolve = (status: AudioProcessingStatus) => {
        clearTimeout(timeout);
        resolve(status);
      };

      const waiters = this.statusWaiters.get(eventId) || [];
      waiters.push(wrappedResolve);
      this.statusWaiters.set(eventId, waiters);
    });
  }

  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  createReadStream(filePath: string): fs.ReadStream {
    return fs.createReadStream(filePath);
  }

  deleteFile(filePath: string): void {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  cleanup(eventId: string): void {
    this.statusMap.delete(eventId);
    this.statusWaiters.delete(eventId);
    
    // Try to delete input file with various formats (in case format was detected dynamically)
    const possibleFormats = ['.webm', '.ogg', '.wav', '.mp3', '.m4a', '.flac', this.inputFormat];
    for (const format of possibleFormats) {
      const inputPath = this.getInputAudioPath(eventId, format);
      this.deleteFile(inputPath);
    }
    
    const outputPath = this.getOutputAudioPath(eventId);
    this.deleteFile(outputPath);
  }
}
