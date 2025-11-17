import { EventDetails } from './EventDetails';
import { calendar_v3 } from 'googleapis';

export interface PipelineResult {
  success: boolean;
  transcription?: string;
  eventDetails?: EventDetails;
  calendarEvent?: calendar_v3.Schema$Event;
  operation?: string;
  error?: string;
}
