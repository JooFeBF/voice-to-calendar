import { google, calendar_v3 } from 'googleapis';
import { AuthClient, GoogleAuth, OAuth2Client, BaseExternalAccountClient } from 'google-auth-library';
import { EventDetails, RecurringEventUpdateScope } from '../models';
import logger from '../utils/logger';

export class CalendarService {
  private calendar: calendar_v3.Calendar;
  private calendarId: string;

  constructor(auth: AuthClient, calendarId: string) {
    this.calendar = google.calendar({ 
      version: 'v3', 
      auth: auth as GoogleAuth | OAuth2Client | BaseExternalAccountClient | string 
    });
    this.calendarId = calendarId;
  }

  async listEvents(
    timeMin?: string,
    timeMax?: string,
    maxResults: number = 50
  ): Promise<calendar_v3.Schema$Event[]> {
    logger.info('Listing calendar events', {
      timeMin,
      timeMax,
      maxResults
    });

    try {
      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: timeMin || new Date().toISOString(),
        timeMax: timeMax,
        maxResults,
        singleEvents: true,
        orderBy: 'startTime'
      });

      const events = response.data.items || [];
      logger.info('Calendar events retrieved successfully', {
        count: events.length
      });

      return events;
    } catch (error) {
      logger.error('Google Calendar API error while listing events', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timeMin,
        timeMax
      });
      throw error;
    }
  }

  async getEventInstances(
    recurringEventId: string,
    timeMin?: string,
    timeMax?: string,
    maxResults: number = 100
  ): Promise<calendar_v3.Schema$Event[]> {
    const response = await this.calendar.events.instances({
      calendarId: this.calendarId,
      eventId: recurringEventId,
      timeMin: timeMin || new Date().toISOString(),
      timeMax: timeMax,
      maxResults,
      showDeleted: false
    });

    return response.data.items || [];
  }

  async createEvent(eventDetails: EventDetails): Promise<calendar_v3.Schema$Event> {
    logger.info('Creating calendar event', {
      title: eventDetails.title,
      startTime: eventDetails.start_time,
      endTime: eventDetails.end_time,
      location: eventDetails.location,
      hasRecurrence: !!eventDetails.recurrence
    });

    const event: calendar_v3.Schema$Event = {
      summary: eventDetails.title,
      location: eventDetails.location,
      description: eventDetails.description,
      start: {
        dateTime: eventDetails.start_time,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: eventDetails.end_time || 
                 new Date(new Date(eventDetails.start_time).getTime() + 3600000).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      attendees: eventDetails.attendees?.map(email => ({ email })),
      recurrence: eventDetails.recurrence,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 1440 },
          { method: 'popup', minutes: 10 }
        ]
      }
    };

    try {
      const response = await this.calendar.events.insert({
        calendarId: this.calendarId,
        requestBody: event,
        sendUpdates: 'all'
      });

      logger.info('Calendar event created successfully', {
        eventId: response.data.id,
        title: eventDetails.title
      });

      return response.data;
    } catch (error) {
      logger.error('Google Calendar API error while creating event', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        eventDetails
      });
      throw error;
    }
  }

  async updateEvent(eventDetails: EventDetails): Promise<calendar_v3.Schema$Event> {
    if (!eventDetails.event_id) {
      logger.error('Update event called without event ID');
      throw new Error('Event ID is required for update operation');
    }

    logger.info('Updating calendar event', {
      eventId: eventDetails.event_id,
      title: eventDetails.title
    });

    const event: calendar_v3.Schema$Event = {
      summary: eventDetails.title,
      location: eventDetails.location,
      description: eventDetails.description,
      start: {
        dateTime: eventDetails.start_time,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: eventDetails.end_time || 
                 new Date(new Date(eventDetails.start_time).getTime() + 3600000).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      attendees: eventDetails.attendees?.map(email => ({ email })),
      recurrence: eventDetails.recurrence,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 1440 },
          { method: 'popup', minutes: 10 }
        ]
      }
    };

    try {
      const response = await this.calendar.events.update({
        calendarId: this.calendarId,
        eventId: eventDetails.event_id,
        requestBody: event,
        sendUpdates: 'all'
      });

      logger.info('Calendar event updated successfully', {
        eventId: response.data.id
      });

      return response.data;
    } catch (error) {
      logger.error('Google Calendar API error while updating event', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        eventId: eventDetails.event_id
      });
      throw error;
    }
  }

  async updateRecurringEvent(
    eventDetails: EventDetails,
    scope: RecurringEventUpdateScope
  ): Promise<calendar_v3.Schema$Event> {
    if (!eventDetails.event_id) {
      logger.error('Update recurring event called without event ID');
      throw new Error('Event ID is required for update operation');
    }

    logger.info('Updating recurring calendar event', {
      eventId: eventDetails.event_id,
      scope,
      title: eventDetails.title
    });

    if (scope === 'this_event') {
      const event: calendar_v3.Schema$Event = {
        summary: eventDetails.title,
        location: eventDetails.location,
        description: eventDetails.description,
        start: {
          dateTime: eventDetails.start_time,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: eventDetails.end_time || 
                   new Date(new Date(eventDetails.start_time).getTime() + 3600000).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        attendees: eventDetails.attendees?.map(email => ({ email })),
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 1440 },
            { method: 'popup', minutes: 10 }
          ]
        }
      };

      const response = await this.calendar.events.update({
        calendarId: this.calendarId,
        eventId: eventDetails.event_id,
        requestBody: event,
        sendUpdates: 'all'
      });

      return response.data;

    } else if (scope === 'this_and_following' || scope === 'all_events') {
      const recurringEventId = eventDetails.recurring_event_id || eventDetails.event_id;
      
      if (scope === 'this_and_following') {
        // Get the original recurring event to extract its recurrence rules
        const originalEvent = await this.calendar.events.get({
          calendarId: this.calendarId,
          eventId: recurringEventId
        });

        if (!originalEvent.data.recurrence || originalEvent.data.recurrence.length === 0) {
          throw new Error('Event does not have recurrence rules');
        }

        // Get the target instance details
        const instances = await this.getEventInstances(recurringEventId);
        const targetInstance = instances.find(inst => inst.id === eventDetails.event_id);
        
        if (!targetInstance || !targetInstance.start?.dateTime || !targetInstance.end?.dateTime) {
          throw new Error('Could not find the target event instance with required time information');
        }

        const targetStartTime = new Date(targetInstance.start.dateTime);
        const targetEndTime = new Date(targetInstance.end.dateTime);
        const originalDuration = targetEndTime.getTime() - targetStartTime.getTime();
        
        // Calculate new times
        const newStartTime = new Date(eventDetails.start_time);
        const newEndTime = eventDetails.end_time 
          ? new Date(eventDetails.end_time)
          : new Date(newStartTime.getTime() + originalDuration);

        // IMPORTANT: Save the original recurrence rules before any modifications
        const originalRecurrenceRules = [...(originalEvent.data.recurrence || [])];
        
        logger.info('Splitting recurring event for "this and following" update', {
          recurringEventId,
          targetStartTime: targetStartTime.toISOString(),
          newStartTime: newStartTime.toISOString(),
          originalRecurrence: originalRecurrenceRules
        });

        // Extract the original UNTIL if it exists (to preserve it in the new event)
        let originalUntil: string | null = null;
        const originalRRule = originalRecurrenceRules.find(r => r.startsWith('RRULE:'));
        if (originalRRule) {
          const untilMatch = originalRRule.match(/UNTIL=([^;]+)/);
          if (untilMatch) {
            originalUntil = untilMatch[1];
          }
        }

        // Step 1: Update the original recurring event to end BEFORE the target instance
        // CRITICAL: Must use UTC methods because Google Calendar uses UTC times!
        
        // Get the start of the target day in UTC (not local time!)
        const targetDate = new Date(targetStartTime);
        targetDate.setUTCHours(0, 0, 0, 0); // Start of target day in UTC
        
        // Set cutoff to 1 second before the target day starts (in UTC)
        const cutoffTime = new Date(targetDate.getTime() - 1000);
        
        // Format UNTIL in iCalendar format: YYYYMMDDTHHmmssZ (no hyphens, no colons)
        const formatForRRule = (date: Date): string => {
          return date.toISOString()
            .replace(/[-:]/g, '')     // Remove hyphens and colons
            .replace(/\.\d{3}/, '');  // Remove milliseconds
        };

        const cutoffTimeFormatted = formatForRRule(cutoffTime);
        
        logger.info('Calculated cutoff time for trimming (UTC)', {
          targetStartTime: targetStartTime.toISOString(),
          targetDate: targetDate.toISOString(),
          cutoffTime: cutoffTime.toISOString(),
          cutoffTimeFormatted,
          timezone: 'UTC'
        });

        // Modify the RRULE to end at the cutoff time (use original saved rules)
        const updatedRecurrence = originalRecurrenceRules.map(rule => {
          if (rule.startsWith('RRULE:')) {
            // Remove any existing UNTIL or COUNT
            let newRule = rule.replace(/;UNTIL=[^;]+/, '').replace(/;COUNT=\d+/, '');
            // Add the new UNTIL to trim the series
            newRule += `;UNTIL=${cutoffTimeFormatted}`;
            return newRule;
          }
          return rule;
        });

        logger.info('Trimming original recurring event', {
          recurringEventId,
          originalRecurrence: originalRecurrenceRules,
          updatedRecurrence,
          cutoffTime: cutoffTime.toISOString()
        });

        // Only send specific fields to avoid conflicts (don't spread all original data)
        await this.calendar.events.update({
          calendarId: this.calendarId,
          eventId: recurringEventId,
          requestBody: {
            summary: originalEvent.data.summary,
            location: originalEvent.data.location,
            description: originalEvent.data.description,
            start: originalEvent.data.start,
            end: originalEvent.data.end,
            recurrence: updatedRecurrence,
            attendees: originalEvent.data.attendees,
            reminders: originalEvent.data.reminders
          },
          sendUpdates: 'all'
        });

        logger.info('Trimmed original recurring event successfully', {
          recurringEventId,
          newUntil: cutoffTimeFormatted
        });

        // Step 2: Create a new recurring event starting from the target instance with new details
        // Use the ORIGINAL saved recurrence rules (before trimming)
        const newRecurrenceRules = originalRecurrenceRules.map(rule => {
          if (rule.startsWith('RRULE:')) {
            // Start with the original rule
            let newRule = rule;
            
            // The original rule might already have an UNTIL - if so, keep it
            // If not, the recurrence continues indefinitely (which is correct)
            // We don't need to modify anything if the original UNTIL is already there
            
            return newRule;
          }
          // Preserve EXDATE, RDATE, and other recurrence components as-is
          return rule;
        });

        logger.info('Prepared recurrence rules for new event', {
          originalRecurrence: originalRecurrenceRules,
          newRecurrence: newRecurrenceRules,
          willContinueIndefinitely: !originalUntil,
          originalUntil
        });

        const newRecurringEvent: calendar_v3.Schema$Event = {
          summary: eventDetails.title,
          location: eventDetails.location,
          description: eventDetails.description,
          start: {
            dateTime: newStartTime.toISOString(),
            timeZone: originalEvent.data.start?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
          },
          end: {
            dateTime: newEndTime.toISOString(),
            timeZone: originalEvent.data.end?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
          },
          recurrence: newRecurrenceRules,
          attendees: eventDetails.attendees?.map(email => ({ email })),
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 1440 },
              { method: 'popup', minutes: 10 }
            ]
          }
        };

        logger.info('Creating new recurring event for "this and following"', {
          newRecurrence: newRecurrenceRules,
          startTime: newStartTime.toISOString(),
          endTime: newEndTime.toISOString(),
          title: eventDetails.title
        });

        const newEventResponse = await this.calendar.events.insert({
          calendarId: this.calendarId,
          requestBody: newRecurringEvent,
          sendUpdates: 'all'
        });

        logger.info('Created new recurring event successfully', {
          newEventId: newEventResponse.data.id,
          recurrence: newEventResponse.data.recurrence,
          startTime: newStartTime.toISOString()
        });

        // Cleanup any duplicate on transition day caused by API boundary quirk
        await this.cleanupDuplicateOnTransitionDay(
          recurringEventId,
          newEventResponse.data.id!,
          targetStartTime,
          eventDetails.title
        );

        return newEventResponse.data;

      } else {
        const event: calendar_v3.Schema$Event = {
          summary: eventDetails.title,
          location: eventDetails.location,
          description: eventDetails.description,
          attendees: eventDetails.attendees?.map(email => ({ email })),
          recurrence: eventDetails.recurrence,
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 1440 },
              { method: 'popup', minutes: 10 }
            ]
          }
        };

        const response = await this.calendar.events.update({
          calendarId: this.calendarId,
          eventId: recurringEventId,
          requestBody: event,
          sendUpdates: 'all'
        });

        return response.data;
      }
    }

    throw new Error(`Invalid update scope: ${scope}`);
  }

  async deleteEvent(eventId: string, deleteScope?: 'this_event' | 'all_events'): Promise<void> {
    logger.info('Deleting calendar event', { eventId, deleteScope });

    try {
      // First check if the event exists and get its details
      let event;
      try {
        const response = await this.calendar.events.get({
          calendarId: this.calendarId,
          eventId
        });
        event = response.data;
      } catch (getError: any) {
        // If event doesn't exist or is already deleted, treat as success (idempotent)
        if (getError.message?.includes('Resource has been deleted') || 
            getError.message?.includes('Not Found') ||
            getError.code === 404) {
          logger.info('Event already deleted, treating as success', { eventId });
          return;
        }
        // Re-throw if it's a different error
        throw getError;
      }

      // Determine the correct event ID to delete based on scope
      let targetEventId = eventId;
      const isRecurringInstance = !!event.recurringEventId;
      const isRecurringSeries = !isRecurringInstance && event.recurrence && event.recurrence.length > 0;
      
      // Handle recurring events
      if (isRecurringInstance) {
        if (deleteScope === 'this_event') {
          // Delete only this instance by cancelling it
          logger.info('Deleting single instance of recurring event', {
            instanceId: eventId,
            seriesId: event.recurringEventId
          });
          
          event.status = 'cancelled';
          await this.calendar.events.update({
            calendarId: this.calendarId,
            eventId,
            requestBody: event,
            sendUpdates: 'all'
          });
          
          logger.info('Recurring event instance cancelled successfully', { eventId });
          return;
        } else {
          // Delete all instances by deleting the master recurring event
          if (!event.recurringEventId) {
            throw new Error('Cannot find master recurring event ID');
          }
          targetEventId = event.recurringEventId;
          logger.info('Deleting all instances via master recurring event', {
            instanceId: eventId,
            masterEventId: targetEventId
          });
        }
      } else if (isRecurringSeries) {
        logger.info('Deleting master recurring event (all instances)', {
          masterEventId: eventId,
          recurrence: event.recurrence
        });
      } else {
        // This is a single event
        logger.info('Deleting single event', { eventId });
      }

      await this.calendar.events.delete({
        calendarId: this.calendarId,
        eventId: targetEventId,
        sendUpdates: 'all'
      });

      logger.info('Calendar event deleted successfully', { 
        requestedId: eventId,
        deletedId: targetEventId,
        deleteScope,
        deletedAllInstances: targetEventId !== eventId || isRecurringSeries
      });
    } catch (error: any) {
      // Handle "Resource has been deleted" error gracefully - this can happen
      // in race conditions when multiple requests try to delete the same event
      if (error.message?.includes('Resource has been deleted') || 
          error.message?.includes('Not Found') ||
          error.code === 404) {
        logger.info('Event was already deleted (likely by concurrent request), treating as success', { 
          eventId 
        });
        return;
      }

      logger.error('Google Calendar API error while deleting event', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        eventId
      });
      throw error;
    }
  }

  async cancelEventInstance(instanceId: string): Promise<void> {
    logger.info('Cancelling calendar event instance', { instanceId });

    try {
      const event = await this.calendar.events.get({
        calendarId: this.calendarId,
        eventId: instanceId
      });

      // Check if already cancelled
      if (event.data.status === 'cancelled') {
        logger.info('Event instance already cancelled, treating as success', { instanceId });
        return;
      }

      event.data.status = 'cancelled';

      await this.calendar.events.update({
        calendarId: this.calendarId,
        eventId: instanceId,
        requestBody: event.data,
        sendUpdates: 'all'
      });

      logger.info('Calendar event instance cancelled successfully', { instanceId });
    } catch (error: any) {
      // Handle "Resource has been deleted" or "Not Found" errors gracefully
      if (error.message?.includes('Resource has been deleted') || 
          error.message?.includes('Not Found') ||
          error.code === 404) {
        logger.info('Event instance was already deleted/cancelled (likely by concurrent request), treating as success', { 
          instanceId 
        });
        return;
      }

      logger.error('Google Calendar API error while cancelling event instance', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        instanceId
      });
      throw error;
    }
  }

  private async cleanupDuplicateOnTransitionDay(
    oldRecurringEventId: string,
    newRecurringEventId: string,
    transitionDate: Date,
    eventTitle: string
  ): Promise<void> {
    // Get start and end of transition day in UTC
    const dayStart = new Date(transitionDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    
    const dayEnd = new Date(transitionDate);
    dayEnd.setUTCHours(23, 59, 59, 999);
    
    logger.info('Checking for duplicate instances on transition day', {
      transitionDate: transitionDate.toISOString(),
      dayStart: dayStart.toISOString(),
      dayEnd: dayEnd.toISOString(),
      oldSeriesId: oldRecurringEventId,
      newSeriesId: newRecurringEventId
    });

    try {
      // List all events on the transition day
      const instances = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString(),
        singleEvents: true
      });

      // Find instances matching the event title
      const matchingInstances = (instances.data.items || []).filter(
        inst => inst.summary === eventTitle
      );

      logger.info('Found instances on transition day', {
        total: matchingInstances.length,
        instances: matchingInstances.map(i => ({
          id: i.id,
          recurringEventId: i.recurringEventId,
          start: i.start?.dateTime
        }))
      });

      // Delete any instance from the OLD series
      for (const instance of matchingInstances) {
        if (instance.recurringEventId === oldRecurringEventId) {
          logger.info('Deleting duplicate instance from old series', {
            instanceId: instance.id,
            recurringEventId: instance.recurringEventId,
            start: instance.start?.dateTime
          });
          
          await this.calendar.events.delete({
            calendarId: this.calendarId,
            eventId: instance.id!,
            sendUpdates: 'all'
          });
          
          logger.info('Deleted duplicate instance successfully');
        }
      }
    } catch (error: any) {
      // Log error but don't fail the main operation
      logger.error('Error during duplicate cleanup on transition day', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        oldSeriesId: oldRecurringEventId,
        newSeriesId: newRecurringEventId,
        transitionDate: transitionDate.toISOString()
      });
      // Continue without throwing - cleanup is best-effort
    }
  }

  async cancelCurrentRecurringInstance(seriesId: string, instanceStartTime: Date): Promise<void> {
    logger.info('Cancelling current instance of recurring series', { 
      seriesId, 
      instanceStartTime: instanceStartTime.toISOString() 
    });

    try {
      const startOfDay = new Date(instanceStartTime);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(instanceStartTime);
      endOfDay.setHours(23, 59, 59, 999);

      const instances = await this.getEventInstances(
        seriesId,
        startOfDay.toISOString(),
        endOfDay.toISOString()
      );

      const targetInstance = instances.find(inst => {
        if (!inst.start?.dateTime) return false;
        const instStart = new Date(inst.start.dateTime);
        return Math.abs(instStart.getTime() - instanceStartTime.getTime()) < 60000;
      });

      if (!targetInstance || !targetInstance.id) {
        // Check if it might have been already cancelled/deleted
        logger.info('Target instance not found, may have been already cancelled/deleted', { 
          seriesId,
          instanceStartTime: instanceStartTime.toISOString()
        });
        return;
      }

      // Check if already cancelled
      if (targetInstance.status === 'cancelled') {
        logger.info('Recurring instance already cancelled, treating as success', { 
          instanceId: targetInstance.id 
        });
        return;
      }

      targetInstance.status = 'cancelled';

      await this.calendar.events.update({
        calendarId: this.calendarId,
        eventId: targetInstance.id,
        requestBody: targetInstance,
        sendUpdates: 'all'
      });

      logger.info('Current instance of recurring series cancelled successfully', { 
        instanceId: targetInstance.id 
      });
    } catch (error: any) {
      // Handle "Resource has been deleted" or "Not Found" errors gracefully
      if (error.message?.includes('Resource has been deleted') || 
          error.message?.includes('Not Found') ||
          error.code === 404) {
        logger.info('Recurring instance was already deleted/cancelled (likely by concurrent request), treating as success', { 
          seriesId,
          instanceStartTime: instanceStartTime.toISOString()
        });
        return;
      }

      logger.error('Google Calendar API error while cancelling recurring instance', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        seriesId,
        instanceStartTime: instanceStartTime.toISOString()
      });
      throw error;
    }
  }

  async getEvent(eventId: string): Promise<calendar_v3.Schema$Event> {
    logger.debug('Getting calendar event', { eventId });

    try {
      const response = await this.calendar.events.get({
        calendarId: this.calendarId,
        eventId
      });

      logger.debug('Calendar event retrieved successfully', {
        eventId,
        title: response.data.summary
      });

      return response.data;
    } catch (error) {
      logger.error('Google Calendar API error while getting event', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        eventId
      });
      throw error;
    }
  }

  formatEventDescription(event: calendar_v3.Schema$Event): string {
    const title = event.summary || 'Sin título';
    
    const formatDateTime = (dateTimeStr?: string | null): string => {
      if (!dateTimeStr) return 'hora desconocida';
      
      try {
        const date = new Date(dateTimeStr);
        const options: Intl.DateTimeFormatOptions = {
          hour: '2-digit',
          minute: '2-digit',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
        
        return date.toLocaleString('es-ES', options);
      } catch (error) {
        return 'hora desconocida';
      }
    };
    
    const startTime = formatDateTime(event.start?.dateTime || event.start?.date);
    const endTime = formatDateTime(event.end?.dateTime || event.end?.date);
    const location = event.location || 'sin ubicación';
    const description = event.description || 'sin descripción';
    
    return `Evento: ${title}. Comienza el ${startTime}, termina el ${endTime}. Ubicación: ${location}. Descripción: ${description}.`;
  }
}
