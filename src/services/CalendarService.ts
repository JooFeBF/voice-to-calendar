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
        const instances = await this.getEventInstances(recurringEventId);
        const targetInstance = instances.find(inst => inst.id === eventDetails.event_id);
        
        if (!targetInstance || !targetInstance.start?.dateTime) {
          throw new Error('Could not find the target event instance');
        }

        const targetStartTime = new Date(targetInstance.start.dateTime);
        const instancesAfter = instances.filter(inst => {
          const instStart = inst.start?.dateTime;
          return instStart && new Date(instStart) >= targetStartTime;
        });

        for (const instance of instancesAfter) {
          if (!instance.id) continue;
          
          const event: calendar_v3.Schema$Event = {
            summary: eventDetails.title,
            location: eventDetails.location,
            description: eventDetails.description,
            attendees: eventDetails.attendees?.map(email => ({ email })),
            reminders: {
              useDefault: false,
              overrides: [
                { method: 'email', minutes: 1440 },
                { method: 'popup', minutes: 10 }
              ]
            }
          };

          await this.calendar.events.update({
            calendarId: this.calendarId,
            eventId: instance.id,
            requestBody: event,
            sendUpdates: 'all'
          });
        }

        const response = await this.calendar.events.get({
          calendarId: this.calendarId,
          eventId: eventDetails.event_id
        });

        return response.data;

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

  async deleteEvent(eventId: string): Promise<void> {
    logger.info('Deleting calendar event', { eventId });

    try {
      await this.calendar.events.delete({
        calendarId: this.calendarId,
        eventId,
        sendUpdates: 'all'
      });

      logger.info('Calendar event deleted successfully', { eventId });
    } catch (error) {
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

      event.data.status = 'cancelled';

      await this.calendar.events.update({
        calendarId: this.calendarId,
        eventId: instanceId,
        requestBody: event.data,
        sendUpdates: 'all'
      });

      logger.info('Calendar event instance cancelled successfully', { instanceId });
    } catch (error) {
      logger.error('Google Calendar API error while cancelling event instance', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        instanceId
      });
      throw error;
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
        throw new Error('Could not find the target instance to cancel');
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
    } catch (error) {
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
