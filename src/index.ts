import { GoogleAuth, AuthClient } from 'google-auth-library';
import { AudioToCalendarController } from './controllers';
import { getConfig } from './config';
import dotenv from 'dotenv';

dotenv.config();

async function authorize(): Promise<AuthClient> {
  const config = getConfig();
  const auth = new GoogleAuth({
    keyFile: config.googleServiceAccountPath,
    scopes: ['https://www.googleapis.com/auth/calendar']
  });

  const client = await auth.getClient();
  return client;
}

async function main(): Promise<void> {
  const config = getConfig();

  const auth = await authorize();
  const controller = new AudioToCalendarController(
    config.openaiApiKey, 
    auth, 
    config.calendarEmail,
    config.audioInputFormat,
    config.audioOutputFormat,
    config.ttsVoice,
    config.ttsSpeed
  );

  const result = await controller.processAudioFile(config.audioFilePath);
  console.log('Result:', result);
}

export async function generateEventAudio(eventId: string, outputPath: string): Promise<{ success: boolean; audioPath?: string; error?: string }> {
  const config = getConfig();

  const auth = await authorize();
  const controller = new AudioToCalendarController(
    config.openaiApiKey, 
    auth, 
    config.calendarEmail,
    config.audioInputFormat,
    config.audioOutputFormat,
    config.ttsVoice,
    config.ttsSpeed
  );

  return await controller.generateEventAudioAndDelete(eventId, outputPath);
}

main().catch(console.error);
