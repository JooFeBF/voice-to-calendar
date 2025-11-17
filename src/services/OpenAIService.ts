import OpenAI from 'openai';
import fs from 'fs';
import { calendar_v3 } from 'googleapis';
import { EventOperation, RecurringEventUpdateScope } from '../models';
import logger from '../utils/logger';

interface ExtractedEventData {
  operation: EventOperation;
  event_id?: string;
  title?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  description?: string;
  attendees?: string[];
  recurrence?: string[];
  update_scope?: RecurringEventUpdateScope;
}

export class OpenAIService {
  private client: OpenAI;
  private audioInputFormat: string;
  private audioOutputFormat: string;

  constructor(apiKey: string, audioInputFormat: string, audioOutputFormat: string) {
    this.client = new OpenAI({ apiKey });
    this.audioInputFormat = audioInputFormat;
    this.audioOutputFormat = audioOutputFormat;
    this.validateAudioFormats();
  }

  private validateAudioFormats(): void {
    const validInputFormats = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm', '.flac', '.aac', '.ogg'];
    const validOutputFormats = ['.mp3', '.opus', '.aac', '.flac', '.wav', '.pcm'];

    if (!validInputFormats.includes(this.audioInputFormat)) {
      const error = `Invalid audio input format: ${this.audioInputFormat}. Supported formats: ${validInputFormats.join(', ')}`;
      logger.error(error);
      throw new Error(error);
    }

    if (!validOutputFormats.includes(this.audioOutputFormat)) {
      const error = `Invalid audio output format: ${this.audioOutputFormat}. Supported formats: ${validOutputFormats.join(', ')}`;
      logger.error(error);
      throw new Error(error);
    }

    logger.info('Audio formats validated', {
      inputFormat: this.audioInputFormat,
      outputFormat: this.audioOutputFormat
    });
  }

  async transcribeAudio(filePath: string): Promise<string> {
    logger.info('Starting audio transcription', { filePath });
    const startTime = Date.now();

    try {
      const transcription = await this.client.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: 'whisper-1',
        response_format: 'text',
        language: 'es'
      });
      
      const duration = Date.now() - startTime;
      logger.info('Audio transcription completed', {
        filePath,
        duration: `${duration}ms`,
        transcriptionLength: transcription.length
      });

      return transcription;
    } catch (error) {
      logger.error('OpenAI transcription API error', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        duration: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  }

  async generateAudioDescription(text: string, outputPath: string): Promise<string> {
    logger.info('Starting TTS audio generation', { 
      outputPath,
      textLength: text.length 
    });
    const startTime = Date.now();

    const formatWithoutDot = this.audioOutputFormat.startsWith('.') 
      ? this.audioOutputFormat.slice(1) 
      : this.audioOutputFormat;

    try {
      const speechResponse = await this.client.audio.speech.create({
        model: 'tts-1',
        voice: 'nova',
        input: text,
        response_format: formatWithoutDot as 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm'
      });

      const buffer = Buffer.from(await speechResponse.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);
      
      const duration = Date.now() - startTime;
      logger.info('TTS audio generation completed', {
        outputPath,
        duration: `${duration}ms`,
        bufferSize: buffer.length,
        format: formatWithoutDot
      });

      return outputPath;
    } catch (error) {
      logger.error('OpenAI TTS API error', {
        outputPath,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        duration: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  }

  async extractEventDetails(
    text: string, 
    existingEvents: calendar_v3.Schema$Event[]
  ): Promise<ExtractedEventData> {
    logger.info('Starting event details extraction', {
      textLength: text.length,
      existingEventsCount: existingEvents.length
    });
    const startTime = Date.now();

    const eventsContext = existingEvents.length > 0 
      ? `\n\nEventos existentes en el calendario:\n${existingEvents.slice(0, 10).map(e => {
          const isRecurring = e.recurringEventId ? '(Instancia de evento recurrente)' : e.recurrence ? '(Evento recurrente)' : '';
          return `- ID: ${e.id}\n  Título: ${e.summary}\n  Inicio: ${e.start?.dateTime || e.start?.date}\n  Fin: ${e.end?.dateTime || e.end?.date}\n  Ubicación: ${e.location || 'N/A'}\n  Descripción: ${e.description || 'N/A'}\n  ${isRecurring}${e.recurringEventId ? `\n  ID de Evento Recurrente: ${e.recurringEventId}` : ''}`;
        }).join('\n\n')}${existingEvents.length > 10 ? `\n\n... y ${existingEvents.length - 10} eventos más` : ''}`
      : '\n\nNo se encontraron eventos existentes en el calendario.';

    try {
      const completion = await this.client.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `Eres un asistente de calendario. Tu trabajo es SIEMPRE ejecutar una de las funciones disponibles basándote en la solicitud del usuario.
Fecha actual: ${new Date().toISOString()}${eventsContext}

REGLAS IMPORTANTES:
1. SIEMPRE debes llamar a una función - NO respondas con texto conversacional
2. Si un evento IDÉNTICO ya existe (mismo título, hora y recurrencia), usa no_action_needed
3. Si el evento es similar pero no idéntico, créalo de todos modos
4. Para eventos recurrentes, usa formato RRULE (RFC5545)

Ejemplos de RRULE:
- Diario: RRULE:FREQ=DAILY
- Semanal los lunes: RRULE:FREQ=WEEKLY;BYDAY=MO
- Días laborables: RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR
- Mensual el día 15: RRULE:FREQ=MONTHLY;BYMONTHDAY=15
- Hasta una fecha: RRULE:FREQ=DAILY;UNTIL=20251231T235959Z
- 10 veces: RRULE:FREQ=WEEKLY;COUNT=10

Actualizaciones de Eventos Recurrentes:
Al actualizar un evento recurrente, DEBES especificar update_scope:
- "this_event": Actualizar solo esta ocurrencia
- "this_and_following": Actualizar esta y futuras
- "all_events": Actualizar toda la serie

Funciones disponibles:
- create_calendar_event: Para crear un nuevo evento
- update_calendar_event: Para actualizar un evento existente (requiere event_id)
- delete_calendar_event: Para eliminar un evento (requiere event_id)
- no_action_needed: Cuando el evento solicitado ya existe exactamente igual`
        },
        { role: 'user', content: text }
      ],
      tool_choice: "required",
      tools: [
        {
          type: 'function',
          function: {
            name: 'create_calendar_event',
            description: 'Crear un nuevo evento en el calendario',
            parameters: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                start_time: { type: 'string' },
                end_time: { type: 'string' },
                location: { type: 'string' },
                description: { type: 'string' },
                attendees: { type: 'array', items: { type: 'string' } },
                recurrence: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'Reglas de recurrencia en formato RRULE (RFC5545)'
                }
              },
              required: ['title', 'start_time']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'update_calendar_event',
            description: 'Actualizar un evento existente del calendario. Para eventos recurrentes, update_scope es OBLIGATORIO.',
            parameters: {
              type: 'object',
              properties: {
                event_id: { 
                  type: 'string',
                  description: 'El ID del evento a actualizar'
                },
                title: { type: 'string' },
                start_time: { type: 'string' },
                end_time: { type: 'string' },
                location: { type: 'string' },
                description: { type: 'string' },
                attendees: { type: 'array', items: { type: 'string' } },
                recurrence: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'Reglas de recurrencia en formato RRULE (RFC5545)'
                },
                update_scope: {
                  type: 'string',
                  enum: ['this_event', 'this_and_following', 'all_events'],
                  description: 'Para eventos recurrentes: "this_event" para una sola instancia, "this_and_following" para esta y las futuras, "all_events" para toda la serie. OBLIGATORIO para eventos recurrentes.'
                }
              },
              required: ['event_id', 'title', 'start_time']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'delete_calendar_event',
            description: 'Eliminar o cancelar un evento del calendario',
            parameters: {
              type: 'object',
              properties: {
                event_id: { 
                  type: 'string',
                  description: 'El ID del evento a eliminar'
                }
              },
              required: ['event_id']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'no_action_needed',
            description: 'Indicar que no se requiere ninguna acción porque el evento solicitado ya existe exactamente igual en el calendario',
            parameters: {
              type: 'object',
              properties: {
                reason: { 
                  type: 'string',
                  description: 'Breve explicación de por qué no se requiere acción'
                },
                existing_event_id: { 
                  type: 'string',
                  description: 'El ID del evento existente que coincide con la solicitud'
                }
              },
              required: ['reason']
            }
          }
        }
      ]
    });

    const message = completion.choices[0].message;
    const toolCall = message.tool_calls?.[0];
    
    if (!toolCall) {
      logger.error('OpenAI API did not return event details', {
        response: JSON.stringify(message),
        finishReason: completion.choices[0].finish_reason,
        content: message.content,
        hasToolCalls: !!message.tool_calls,
        toolCallsLength: message.tool_calls?.length || 0
      });
      throw new Error('No se pudieron extraer los detalles del evento');
    }

    const args = JSON.parse(toolCall.function.arguments);
    
    let operation: EventOperation;
    if (toolCall.function.name === 'create_calendar_event') {
      operation = 'create';
    } else if (toolCall.function.name === 'update_calendar_event') {
      operation = 'update';
    } else if (toolCall.function.name === 'delete_calendar_event') {
      operation = 'delete';
    } else if (toolCall.function.name === 'no_action_needed') {
      operation = 'no_action';
    } else {
      logger.error('Unknown operation from OpenAI', { 
        functionName: toolCall.function.name 
      });
      throw new Error(`Operación desconocida: ${toolCall.function.name}`);
    }

    const duration = Date.now() - startTime;
    logger.info('Event details extraction completed', {
      operation,
      duration: `${duration}ms`,
      eventId: args.event_id,
      title: args.title,
      reason: args.reason
    });

    return {
      operation,
      event_id: args.event_id || args.existing_event_id,
      title: args.title,
      start_time: args.start_time,
      end_time: args.end_time,
      location: args.location,
      description: args.description || args.reason,
      attendees: args.attendees,
      recurrence: args.recurrence,
      update_scope: args.update_scope as RecurringEventUpdateScope | undefined
    };
    } catch (error) {
      logger.error('OpenAI event extraction API error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        duration: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  }
}
