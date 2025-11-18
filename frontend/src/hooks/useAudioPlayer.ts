import { useState, useRef, useCallback } from 'react';

interface UseAudioPlayerReturn {
  play: (eventId: string) => Promise<void>;
  stop: () => void;
  isPlaying: boolean;
  error: string | null;
}

export function useAudioPlayer(): UseAudioPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Dispatch custom event for playing state changes
  const updatePlayingState = (playing: boolean) => {
    setIsPlaying(playing);
    window.dispatchEvent(new CustomEvent('audioPlayingChange', { 
      detail: { isPlaying: playing } 
    }));
  };

  const stop = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (err) {
        console.error('Error stopping audio:', err);
      }
      sourceNodeRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    updatePlayingState(false);
  }, []);

  const play = useCallback(async (eventId: string) => {
    try {
      console.log('[AudioPlayer] Starting playback for event:', eventId);
      
      // Stop any currently playing audio
      stop();

      setError(null);
      updatePlayingState(true);

      // Initialize AudioContext if needed
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log('[AudioPlayer] Created new AudioContext');
      }

      const audioContext = audioContextRef.current;

      // Resume audio context if suspended (required in some browsers)
      if (audioContext.state === 'suspended') {
        console.log('[AudioPlayer] Resuming suspended AudioContext');
        await audioContext.resume();
      }

      abortControllerRef.current = new AbortController();

      // Fetch audio from server
      const audioUrl = `/api/audio/download/${eventId}`;
      console.log('[AudioPlayer] Fetching audio from:', audioUrl);
      
      const response = await fetch(audioUrl, {
        signal: abortControllerRef.current.signal,
      });

      console.log('[AudioPlayer] Audio fetch response:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type')
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('[AudioPlayer] Audio fetch failed:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        throw new Error(`Failed to download audio: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Get audio data as array buffer
      console.log('[AudioPlayer] Reading audio data as array buffer...');
      const arrayBuffer = await response.arrayBuffer();
      console.log('[AudioPlayer] Audio data received, size:', arrayBuffer.byteLength, 'bytes');

      // Decode audio data
      console.log('[AudioPlayer] Decoding audio data...');
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      console.log('[AudioPlayer] Audio decoded successfully:', {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: audioBuffer.numberOfChannels
      });

      // Create and configure source node
      const sourceNode = audioContext.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(audioContext.destination);

      sourceNodeRef.current = sourceNode;

      // Handle playback end
      sourceNode.onended = () => {
        console.log('[AudioPlayer] Audio playback ended');
        sourceNodeRef.current = null;
        updatePlayingState(false);
      };

      // Handle errors
      sourceNode.onerror = (error) => {
        console.error('[AudioPlayer] Audio playback error:', error);
        sourceNodeRef.current = null;
        updatePlayingState(false);
        setError('Error durante la reproducción de audio');
      };

      // Start playback
      sourceNode.start(0);
      console.log('[AudioPlayer] Audio playback started for event:', eventId);

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[AudioPlayer] Audio playback cancelled');
        updatePlayingState(false);
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Error al reproducir audio';
      setError(errorMessage);
      console.error('[AudioPlayer] Playback error:', err);
      console.error('[AudioPlayer] Error details:', {
        name: err instanceof Error ? err.name : 'Unknown',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });
      updatePlayingState(false);
    }
  }, [stop]);

  return {
    play,
    stop,
    isPlaying,
    error,
  };
}


