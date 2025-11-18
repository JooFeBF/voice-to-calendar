import { useState, useEffect, useRef } from 'react';

interface EventData {
  eventId: string;
  calendarEventId: string;
  title?: string;
  start?: string;
  end?: string;
}

interface UseEventPollerReturn {
  hasEvent: boolean;
  eventData: EventData | null;
  isPlaying: boolean;
  error: string | null;
}

export function useEventPoller(shouldPoll: boolean): UseEventPollerReturn {
  const [hasEvent, setHasEvent] = useState(false);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const pollingIntervalRef = useRef<number | null>(null);
  const lastEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldPoll) {
      // Clear polling when recording
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    const pollForEvents = async () => {
      try {
        console.log('[EventPoller] Polling for events...');
        const response = await fetch('/api/events/current');
        
        if (!response.ok) {
          throw new Error(`Polling failed: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('[EventPoller] Received response:', {
          hasPending: data.hasPending,
          eventId: data.eventId,
          calendarEventId: data.calendarEventId,
          title: data.title,
          error: data.error
        });

        if (data.hasPending && data.eventId) {
          // Check if this is a new event (by calendarEventId to handle recurring events)
          if (data.calendarEventId !== lastEventIdRef.current) {
            console.log('[EventPoller] New event detected:', {
              eventId: data.eventId,
              calendarEventId: data.calendarEventId,
              title: data.title,
              previousCalendarEventId: lastEventIdRef.current
            });
            lastEventIdRef.current = data.calendarEventId;
            setEventData({
              eventId: data.eventId,
              calendarEventId: data.calendarEventId,
              title: data.title,
              start: data.start,
              end: data.end,
            });
            setHasEvent(true);
            setError(null);
          } else {
            console.log('[EventPoller] Same event already detected, skipping:', {
              calendarEventId: data.calendarEventId,
              currentHasEvent: hasEvent
            });
          }
        } else {
          // No pending events
          console.log('[EventPoller] No pending events');
          if (hasEvent && !isPlaying) {
            // Only clear if not currently playing
            console.log('[EventPoller] Clearing event state (not playing)');
            setHasEvent(false);
            setEventData(null);
            lastEventIdRef.current = null;
          } else if (hasEvent && isPlaying) {
            console.log('[EventPoller] Event cleared but audio still playing, will clear after playback');
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al consultar eventos';
        setError(errorMessage);
        console.error('[EventPoller] Polling error:', err);
      }
    };

    // Poll immediately on mount
    pollForEvents();

    // Set up polling interval (every 5 seconds)
    pollingIntervalRef.current = window.setInterval(pollForEvents, 5000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [shouldPoll, hasEvent]);

  // Update playing state externally (managed by useAudioPlayer)
  useEffect(() => {
    const handlePlayingChange = (event: CustomEvent<{ isPlaying: boolean }>) => {
      const wasPlaying = isPlaying;
      const nowPlaying = event.detail.isPlaying;
      setIsPlaying(nowPlaying);
      
      console.log('[EventPoller] Audio playing state changed:', {
        wasPlaying,
        nowPlaying,
        hasEvent
      });
      
      // Clear event after playing is done
      if (wasPlaying && !nowPlaying && hasEvent) {
        console.log('[EventPoller] Audio finished, clearing event state');
        setTimeout(() => {
          setHasEvent(false);
          setEventData(null);
          lastEventIdRef.current = null;
        }, 1000);
      }
    };

    window.addEventListener('audioPlayingChange' as any, handlePlayingChange);

    return () => {
      window.removeEventListener('audioPlayingChange' as any, handlePlayingChange);
    };
  }, [hasEvent, isPlaying]);

  return {
    hasEvent,
    eventData,
    isPlaying,
    error,
  };
}


