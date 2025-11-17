export interface Config {
  openaiApiKey: string;
  googleServiceAccountPath: string;
  audioFilePath: string;
  calendarEmail: string;
  audioInputFormat: string;
  audioOutputFormat: string;
  serverPort: number;
  serverHost: string;
  tempStorageDir: string;
  statusPollTimeout: number;
  maxUploadSize: string;
}

export function getConfig(): Config {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const googleServiceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './service-account-key.json';
  const audioFilePath = process.env.AUDIO_FILE_PATH || './meeting-audio.mp3';
  const calendarEmail = process.env.CALENDAR_EMAIL;
  const audioInputFormat = process.env.AUDIO_INPUT_FORMAT || '.wav';
  const audioOutputFormat = process.env.AUDIO_OUTPUT_FORMAT || '.wav';
  const serverPort = parseInt(process.env.SERVER_PORT || '3000', 10);
  const serverHost = process.env.SERVER_HOST || '0.0.0.0';
  const tempStorageDir = process.env.TEMP_STORAGE_DIR || './temp';
  const statusPollTimeout = parseInt(process.env.STATUS_POLL_TIMEOUT || '30000', 10);
  const maxUploadSize = process.env.MAX_UPLOAD_SIZE || '50mb';

  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  if (!calendarEmail) {
    throw new Error('CALENDAR_EMAIL environment variable is required');
  }

  return {
    openaiApiKey,
    googleServiceAccountPath,
    audioFilePath,
    calendarEmail,
    audioInputFormat,
    audioOutputFormat,
    serverPort,
    serverHost,
    tempStorageDir,
    statusPollTimeout,
    maxUploadSize
  };
}
