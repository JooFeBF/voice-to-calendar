import { OpenAIService, CalendarService, RetryService } from '../services';
import { PipelineOptions, PipelineResult, EventDetails } from '../models';
import { AuthClient } from 'google-auth-library';
import { calendar_v3 } from 'googleapis';
import logger from '../utils/logger';
import { replaceRelativeDate } from '../utils/dateUtils';

export class AudioToCalendarController {
  private openaiService: OpenAIService;
  public readonly calendarService: CalendarService;

  constructor(
    openaiKey: string, 
    googleAuth: AuthClient, 
    calendarEmail: string,
    audioInputFormat: string,
    audioOutputFormat: string
  ) {
    this.openaiService = new OpenAIService(openaiKey, audioInputFormat, audioOutputFormat);
    this.calendarService = new CalendarService(googleAuth, calendarEmail);
  }

  async processAudioFile(
    audioFilePath: string,
    options: PipelineOptions = {}
  ): Promise<PipelineResult> {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 2000;

    logger.info('Starting audio processing pipeline', { 
      audioFilePath, 
      maxRetries, 
      retryDelay 
    });

    try {
      // Transcribe audio
      logger.debug('Transcribing audio file');
      const transcription = await RetryService.retryOperation(
        () => this.openaiService.transcribeAudio(audioFilePath),
        maxRetries,
        retryDelay
      );

      logger.info('Audio transcribed successfully', { 
        transcription: transcription.substring(0, 100) + (transcription.length > 100 ? '...' : '')
      });

      // Fetch existing events
      logger.debug('Fetching existing calendar events');
      const existingEvents = await RetryService.retryOperation(
        () => this.calendarService.listEvents(
          new Date().toISOString(),
          new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          100
        ),
        maxRetries,
        retryDelay
      );

      logger.info('Retrieved existing calendar events', { 
        count: existingEvents.length 
      });

      // Extract event details from transcription
      logger.debug('Extracting event details from transcription');
      const eventDetailsRaw = await RetryService.retryOperation(
        () => this.openaiService.extractEventDetails(transcription, existingEvents),
        maxRetries,
        retryDelay
      );

      logger.info('Event details extracted', { 
        operation: eventDetailsRaw.operation,
        title: eventDetailsRaw.title,
        eventId: eventDetailsRaw.event_id
      });

      let calendarEvent: calendar_v3.Schema$Event | undefined;
      let operationResult: string;

      if (eventDetailsRaw.operation === 'create') {
        const eventDetails: EventDetails = {
          title: eventDetailsRaw.title as string,
          start_time: replaceRelativeDate(eventDetailsRaw.start_time) as string,
          end_time: replaceRelativeDate(eventDetailsRaw.end_time),
          location: eventDetailsRaw.location,
          description: eventDetailsRaw.description,
          attendees: eventDetailsRaw.attendees,
          recurrence: eventDetailsRaw.recurrence
        };
        
        logger.info('Creating calendar event', { eventDetails });
        calendarEvent = await RetryService.retryOperation(
          () => this.calendarService.createEvent(eventDetails),
          maxRetries,
          retryDelay
        );
        operationResult = 'created';
        logger.info('Calendar event created successfully', { 
          calendarEventId: calendarEvent.id 
        });

      } else if (eventDetailsRaw.operation === 'update') {
        if (!eventDetailsRaw.event_id) {
          logger.error('Update operation missing event ID');
          throw new Error('Event ID is required for update operation');
        }

        const targetEvent = existingEvents.find(e => e.id === eventDetailsRaw.event_id);
        const isRecurringInstance = targetEvent?.recurringEventId !== undefined;
        const isRecurringSeries = targetEvent?.recurrence !== undefined;

        const eventDetails: EventDetails = {
          event_id: eventDetailsRaw.event_id,
          title: eventDetailsRaw.title as string,
          start_time: replaceRelativeDate(eventDetailsRaw.start_time) as string,
          end_time: replaceRelativeDate(eventDetailsRaw.end_time),
          location: eventDetailsRaw.location,
          description: eventDetailsRaw.description,
          attendees: eventDetailsRaw.attendees,
          recurrence: eventDetailsRaw.recurrence,
          is_recurring: isRecurringInstance || isRecurringSeries,
          recurring_event_id: targetEvent?.recurringEventId || undefined,
          update_scope: eventDetailsRaw.update_scope
        };

        logger.info('Updating calendar event', { 
          eventDetails,
          isRecurringInstance,
          isRecurringSeries
        });

        if ((isRecurringInstance || isRecurringSeries) && eventDetails.update_scope) {
          logger.debug('Updating recurring event', { 
            scope: eventDetails.update_scope 
          });
          calendarEvent = await RetryService.retryOperation(
            () => this.calendarService.updateRecurringEvent(eventDetails, eventDetails.update_scope!),
            maxRetries,
            retryDelay
          );
          operationResult = `updated (${eventDetails.update_scope})`;
        } else {
          calendarEvent = await RetryService.retryOperation(
            () => this.calendarService.updateEvent(eventDetails),
            maxRetries,
            retryDelay
          );
          operationResult = 'updated';
        }
        
        logger.info('Calendar event updated successfully', { 
          calendarEventId: calendarEvent.id,
          operationResult 
        });

      } else if (eventDetailsRaw.operation === 'delete') {
        logger.info('Deleting calendar event', { 
          eventId: eventDetailsRaw.event_id 
        });
        await RetryService.retryOperation(
          () => this.calendarService.deleteEvent(eventDetailsRaw.event_id as string),
          maxRetries,
          retryDelay
        );
        operationResult = 'deleted';
        logger.info('Calendar event deleted successfully', { 
          eventId: eventDetailsRaw.event_id 
        });
      } else if (eventDetailsRaw.operation === 'no_action') {
        logger.info('No action needed - event already exists', { 
          reason: eventDetailsRaw.description,
          existingEventId: eventDetailsRaw.event_id
        });
        operationResult = 'no_action';
      } else {
        logger.error('Unknown operation type', { 
          operation: eventDetailsRaw.operation 
        });
        throw new Error(`Unknown operation: ${eventDetailsRaw.operation}`);
      }

      logger.info('Audio processing pipeline completed successfully', { 
        operationResult 
      });

      return {
        success: true,
        transcription,
        eventDetails: {
          title: eventDetailsRaw.title || '',
          start_time: eventDetailsRaw.start_time || '',
          end_time: eventDetailsRaw.end_time,
          location: eventDetailsRaw.location,
          description: eventDetailsRaw.description,
          attendees: eventDetailsRaw.attendees,
          recurrence: eventDetailsRaw.recurrence,
          event_id: eventDetailsRaw.event_id,
          update_scope: eventDetailsRaw.update_scope
        },
        calendarEvent,
        operation: operationResult
      };

    } catch (error) {
      logger.error('Pipeline error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        audioFilePath
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async generateEventAudioAndDelete(
    eventId: string,
    outputPath: string,
    options: PipelineOptions = {}
  ): Promise<{ success: boolean; audioPath?: string; error?: string }> {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 2000;

    logger.info('Generating event audio and deleting event', { 
      eventId, 
      outputPath
    });

    try {
      logger.debug('Retrieving calendar event');
      const event = await RetryService.retryOperation(
        () => this.calendarService.getEvent(eventId),
        maxRetries,
        retryDelay
      );

      logger.info('Retrieved calendar event', { 
        eventId,
        summary: event.summary,
        isRecurringSeries: !!event.recurrence,
        isRecurringInstance: !!event.recurringEventId,
        hasDateTime: !!(event.start?.dateTime && event.end?.dateTime),
        startData: event.start,
        endData: event.end
      });

      const now = new Date();
      const eventStart = event.start?.dateTime ? new Date(event.start.dateTime) : null;
      const eventEnd = event.end?.dateTime ? new Date(event.end.dateTime) : null;

      if (!eventStart || !eventEnd) {
        logger.warn('Event missing start or end time', { 
          eventId,
          hasStart: !!event.start,
          hasEnd: !!event.end,
          startDateTime: event.start?.dateTime,
          endDateTime: event.end?.dateTime
        });
        return {
          success: false,
          error: 'Event missing start or end time'
        };
      }

      // Validate that event is currently occurring
      const nowMs = now.getTime();
      const startMs = eventStart.getTime();
      const endMs = eventEnd.getTime();
      const isBeforeStart = nowMs < startMs;
      const isAfterEnd = nowMs > endMs;
      
      logger.info('Time validation check', {
        eventId,
        now: now.toISOString(),
        eventStart: eventStart.toISOString(),
        eventEnd: eventEnd.toISOString(),
        nowMs,
        startMs,
        endMs,
        timeDiffFromStart: (startMs - nowMs) / 1000 / 60, // minutes
        timeDiffFromEnd: (nowMs - endMs) / 1000 / 60, // minutes
        isBeforeStart,
        isAfterEnd,
        validationPasses: !isBeforeStart && !isAfterEnd
      });

      if (now < eventStart || now > eventEnd) {
        const reason = now < eventStart 
          ? `Event starts in ${Math.round((startMs - nowMs) / 1000 / 60)} minutes`
          : `Event ended ${Math.round((nowMs - endMs) / 1000 / 60)} minutes ago`;
          
        logger.info('Event not currently occurring', { 
          eventId, 
          now: now.toISOString(),
          eventStart: eventStart.toISOString(),
          eventEnd: eventEnd.toISOString(),
          reason
        });
        return {
          success: false,
          error: 'Event not currently occurring'
        };
      }

      logger.info('Event is currently occurring - proceeding with audio generation', {
        eventId
      });

      // Generate human-friendly reminder text using AI
      logger.debug('Generating human-friendly reminder text');
      const reminderText = await RetryService.retryOperation(
        () => this.openaiService.generateHumanFriendlyReminderText(event),
        maxRetries,
        retryDelay
      );

      logger.debug('Generating audio from reminder text', { 
        reminderTextLength: reminderText.length,
        reminderText: reminderText.substring(0, 100) + (reminderText.length > 100 ? '...' : '')
      });
      const audioPath = await RetryService.retryOperation(
        () => this.openaiService.generateAudioDescription(reminderText, outputPath),
        maxRetries,
        retryDelay
      );

      logger.info('Audio description generated successfully', { 
        audioPath 
      });

      const isRecurringInstance = !!event.recurringEventId;
      const isRecurringSeries = !!event.recurrence;

      if (isRecurringInstance) {
        logger.debug('Cancelling recurring event instance', { eventId });
        await RetryService.retryOperation(
          () => this.calendarService.cancelEventInstance(eventId),
          maxRetries,
          retryDelay
        );
        logger.info('Recurring event instance cancelled successfully', { eventId });
      } else if (isRecurringSeries) {
        logger.debug('Cancelling current instance of recurring series', { eventId });
        await RetryService.retryOperation(
          () => this.calendarService.cancelCurrentRecurringInstance(eventId, eventStart),
          maxRetries,
          retryDelay
        );
        logger.info('Current instance of recurring series cancelled successfully', { eventId });
      } else {
        logger.debug('Deleting single event', { eventId });
        await RetryService.retryOperation(
          () => this.calendarService.deleteEvent(eventId),
          maxRetries,
          retryDelay
        );
        logger.info('Single event deleted successfully', { eventId });
      }

      return {
        success: true,
        audioPath
      };

    } catch (error) {
      logger.error('Error generating audio and deleting event', {
        eventId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
