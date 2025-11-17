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

  async generateHumanFriendlyReminderText(event: calendar_v3.Schema$Event): Promise<string> {
    logger.info('Generating human-friendly reminder text', {
      eventId: event.id,
      title: event.summary
    });
    const startTime = Date.now();

    const title = event.summary || 'Sin título';
    const startTimeStr = event.start?.dateTime || event.start?.date;
    const endTimeStr = event.end?.dateTime || event.end?.date;
    const location = event.location;
    const description = event.description;

    // Format times for the AI to understand
    let startTimeFormatted = '';
    let endTimeFormatted = '';
    if (startTimeStr) {
      try {
        const start = new Date(startTimeStr);
        startTimeFormatted = start.toLocaleTimeString('es-ES', { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: true 
        });
      } catch (e) {
        startTimeFormatted = startTimeStr;
      }
    }
    if (endTimeStr) {
      try {
        const end = new Date(endTimeStr);
        endTimeFormatted = end.toLocaleTimeString('es-ES', { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: true 
        });
      } catch (e) {
        endTimeFormatted = endTimeStr;
      }
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: `Eres un asistente que genera mensajes naturales y conversacionales en español para recordarle cosas al usuario.

Tu tarea es analizar el contenido del recordatorio y generar un mensaje natural como si le estuvieras hablando directamente.

REGLAS IMPORTANTES:

1. ANALIZA EL CONTENIDO para determinar si necesita hora o no:
   - Si es algo que requiere asistir a un lugar o reunión (cita médica, reunión, clase, evento): INCLUYE las horas
   - Si es algo que debe hacer inmediatamente (tomar pastilla, hacer una tarea, recordar algo): NO incluyas horas, dile que lo haga ahora
   - Ejemplos que NO necesitan hora: "tomar pastilla", "tomar medicamento", "recordar llamar", "hacer ejercicio"
   - Ejemplos que SÍ necesitan hora: "cita médica", "reunión", "clase", "entrevista", "evento"

2. FORMATO DEL MENSAJE:
   - Debe ser un mensaje natural y conversacional, como si le hablaras directamente
   - Usa frases como "Te recuerdo que...", "No olvides que...", "Recuerda que..."
   - NO uses estructuras como "Evento: ...", "Hora: ...", etc.
   - Sé breve (1-2 frases máximo)
   - En segunda persona (tú)

3. CUANDO INCLUIR HORAS:
   - Solo si es algo que requiere asistir a un lugar o reunión
   - Formato: "desde las [hora inicio] hasta las [hora fin]"
   - Usa formato de 12 horas (ej: "3:00 PM", "10:30 AM")

4. CUANDO NO INCLUIR HORAS:
   - Si es algo que debe hacer inmediatamente
   - Dile que lo haga "ahora" o "ya"

Ejemplos de mensajes correctos:
- "Te recuerdo que tienes que tomarte una pastilla ahora"
- "Te recuerdo que tienes una reunión de trabajo desde las 3:00 PM hasta las 4:30 PM"
- "No olvides que tienes cita médica desde las 10:00 AM hasta las 11:00 AM"
- "Recuerda que tienes que llamar a tu mamá ahora"
- "Te recuerdo que tienes clase de yoga desde las 6:00 PM hasta las 7:00 PM"`

          },
          {
            role: 'user',
            content: `Genera un mensaje natural para recordarle al usuario:

Título: ${title}
${startTimeFormatted ? `Hora inicio: ${startTimeFormatted}` : 'Sin hora de inicio'}
${endTimeFormatted ? `Hora fin: ${endTimeFormatted}` : 'Sin hora de fin'}
${location ? `Ubicación: ${location}` : ''}
${description ? `Descripción: ${description}` : ''}

Analiza el contenido y decide si necesita incluir las horas o no. Genera un mensaje natural y conversacional.`
          }
        ],
        max_tokens: 150
      });

      const reminderText = completion.choices[0]?.message?.content?.trim() || title;
      
      const duration = Date.now() - startTime;
      logger.info('Human-friendly reminder text generated', {
        eventId: event.id,
        duration: `${duration}ms`,
        reminderTextLength: reminderText.length,
        reminderText: reminderText.substring(0, 100)
      });

      return reminderText;
    } catch (error) {
      logger.error('OpenAI reminder text generation error', {
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        duration: `${Date.now() - startTime}ms`
      });
      // Fallback to simple format if AI generation fails
      if (startTimeFormatted && endTimeFormatted) {
        return `Te recuerdo que tienes ${title} desde las ${startTimeFormatted} hasta las ${endTimeFormatted}`;
      } else {
        return `Te recuerdo que tienes que ${title} ahora`;
      }
    }
  }

  /**
   * Generates audio from a natural, conversational message.
   * This method should ONLY receive natural messages (e.g., "Te recuerdo que tienes que tomarte una pastilla ahora")
   * and NOT structured messages (e.g., "Evento: ... Hora: ...").
   * The text is passed directly to TTS without any modification or structure.
   * 
   * @param text - Natural, conversational message to convert to audio
   * @param outputPath - Path where the audio file will be saved
   * @returns Path to the generated audio file
   */
  async generateAudioDescription(text: string, outputPath: string): Promise<string> {
    logger.info('Starting TTS audio generation', { 
      outputPath,
      textLength: text.length,
      textPreview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
    });
    const startTime = Date.now();

    const formatWithoutDot = this.audioOutputFormat.startsWith('.') 
      ? this.audioOutputFormat.slice(1) 
      : this.audioOutputFormat;

    try {
      // Pass the natural message directly to TTS - no modification or structure added
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
          content: `Eres un asistente de calendario inteligente. Tu trabajo es SIEMPRE ejecutar una de las funciones disponibles basándote en la solicitud del usuario, interpretando sus intenciones de la manera más lógica y útil posible.
Fecha actual: ${new Date().toISOString()}${eventsContext}

REGLAS IMPORTANTES:
1. SIEMPRE debes llamar a una función - NO respondas con texto conversacional
2. Si un evento IDÉNTICO ya existe (mismo título, hora y recurrencia), usa no_action_needed
3. Si el evento es similar pero no idéntico, créalo de todos modos
4. Para eventos recurrentes, usa formato RRULE (RFC5545)

INTERPRETACIÓN DE PROMPTS AMBIGUOS - DEDUCCIÓN INTELIGENTE:
Cuando el usuario haga una solicitud ambigua o incompleta, debes DEDUCIR la acción más lógica y útil basándote en el contexto y tipo de tarea. SIEMPRE crea un evento útil en lugar de fallar.

PRINCIPIOS PARA PROMPTS AMBIGUOS:

1. TAREAS INMEDIATAS / RECORDATORIOS (sin hora específica):
   - Si el usuario menciona algo que debe hacer pronto (comprar, llamar, tomar medicamento, etc.) pero no especifica hora:
     → Crea un recordatorio para DENTRO DE 5-15 MINUTOS desde ahora
     → Duración típica: 15-30 minutos
   - Ejemplos:
     * "Tengo que ir a comprar comida/abarrotes" → Reminder en 10 minutos, duración 1 hora
     * "Necesito llamar a mamá" → Reminder en 5 minutos, duración 15 minutos
     * "Tengo que tomar mi pastilla" → Reminder en 2 minutos, duración 5 minutos
     * "Debo hacer ejercicio" → Reminder en 30 minutos, duración 1 hora
     * "Tengo que pagar las cuentas" → Reminder en 15 minutos, duración 30 minutos

2. EVENTOS FUTUROS SIN HORA ESPECÍFICA:
   - Si mencionan algo para "mañana", "esta semana", etc. sin hora:
     → Usa una hora lógica según el tipo de evento
   - Ejemplos:
     * Citas médicas/reuniones: 10:00 AM - 11:00 AM (duración 1 hora)
     * Compras/errandes: 2:00 PM - 3:00 PM (duración 1 hora)
     * Ejercicio: 6:00 PM - 7:00 PM (duración 1 hora)
     * Sociales: 7:00 PM - 9:00 PM (duración 2 horas)

3. TAREAS SIN FECHA NI HORA:
   - Si solo mencionan la tarea sin tiempo: Asume que es URGENTE/INMEDIATO
     → Crea recordatorio en 5-10 minutos desde ahora
   - Si la tarea suena rutinaria o no urgente: Mañana a hora razonable

4. CONTEXTO Y TIPO DE TAREA:
   - TAREAS PERSONALES (comprar, hacer, pagar, llamar): Recordatorio cercano (5-15 min)
   - EVENTOS FORMALES (citas, reuniones, clases): Requieren hora específica
   - EVENTOS SOCIALES (visitar, celebrar): Hora típica de socialización (tarde/noche)
   - TAREAS DE SALUD (medicinas, ejercicio, chequeos): Hora apropiada según tipo

5. DEDUCCIÓN INTELIGENTE:
   - Analiza palabras clave que indiquen urgencia: "tengo que", "debo", "necesito", "ahora"
   - Considera el contexto: Si es mediodía y dice "comprar", probablemente quiere hacerlo pronto
   - Usa sentido común: Compras típicamente requieren 1-2 horas, llamadas 15-30 min
   - Prefiere crear eventos útiles con tiempos razonables antes que fallar por falta de información

6. REGLAS DE DURACIÓN POR TIPO:
   - Compras/errandes: 1-2 horas
   - Llamadas telefónicas: 15-30 minutos
   - Tomar medicamento: 5-10 minutos
   - Ejercicio/deportes: 1 hora
   - Reuniones/citas: 1 hora (ajustar si se especifica)
   - Comidas: 1 hora
   - Eventos sociales: 2-3 horas

EJEMPLOS DE INTERPRETACIÓN:
- "Tengo que comprar abarrotes/comida" → Recordatorio en 10 minutos, 1 hora de duración
- "Necesito llamar al doctor" → Recordatorio en 15 minutos, 30 minutos de duración
- "Debo tomar mi medicamento" → Recordatorio en 2 minutos, 5 minutos de duración
- "Tengo que hacer ejercicio" → Recordatorio en 30 minutos, 1 hora de duración
- "Mañana tengo que ir al banco" → Mañana a las 2:00 PM, 1 hora de duración
- "Esta semana tengo cita médica" → Si es lunes-jueves: Esta semana a las 10:00 AM; Si es viernes-domingo: Próxima semana a las 10:00 AM

SIEMPRE crea un evento útil - es mejor crear un evento con tiempos razonables que no crear nada.

FORMATO DE FECHAS RELATIVAS:
Cuando el usuario mencione fechas relativas como "hoy", "en 2 meses", "el próximo lunes", etc., 
DEBES usar el formato especial: currentDate+<milliseconds>
- currentDate+0 = ahora/momento actual
- currentDate+86400000 = en 1 día (24 horas = 86400000 ms)
- currentDate+604800000 = en 1 semana (7 días = 604800000 ms)
- currentDate+2592000000 = en 1 mes aproximado (30 días = 2592000000 ms)
- Calcula los milisegundos necesarios para la fecha relativa mencionada

Ejemplos:
- "hoy a las 3pm" → currentDate+0 (y luego ajusta la hora a las 15:00)
- "mañana" → currentDate+86400000
- "en 2 semanas" → currentDate+1209600000
- "el próximo lunes" → calcula los milisegundos hasta el próximo lunes y usa currentDate+<ms>

Este formato será reemplazado automáticamente con la fecha real cuando se cree o actualice el evento.

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
