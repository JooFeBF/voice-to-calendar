import { useState, useRef, useCallback } from 'react';

interface UseAudioRecorderReturn {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  isRecording: boolean;
  isUploading: boolean;
  error: string | null;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const uploadControllerRef = useRef<AbortController | null>(null);
  const currentEventIdRef = useRef<string | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      chunksRef.current = [];

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // Optimal for speech recognition
        } 
      });

      streamRef.current = stream;

      // Use webm/opus for better compression and browser support
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 16000, // Good quality for speech
      });

      mediaRecorderRef.current = mediaRecorder;

      // Collect audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Start recording with small time slices for streaming
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al iniciar la grabación';
      setError(errorMessage);
      console.error('Recording error:', err);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return;
    }

    return new Promise<void>((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        
        // Stop all audio tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Upload the recorded audio
        if (chunksRef.current.length > 0) {
          await uploadAudio(chunksRef.current);
        }

        chunksRef.current = [];
        resolve();
      };

      mediaRecorder.stop();
    });
  }, []);

  const uploadAudio = async (chunks: Blob[]) => {
    try {
      setIsUploading(true);
      setError(null);

      // Create a single blob from all chunks
      const audioBlob = new Blob(chunks, { type: chunks[0].type });

      // Convert to WAV format if needed (server expects WAV)
      // For simplicity, we'll send the webm and let the server handle conversion
      // In production, you might want to convert on client side

      uploadControllerRef.current = new AbortController();

      // Upload to server
      const uploadResponse = await fetch('/api/audio/upload-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'audio/webm',
        },
        body: audioBlob,
        signal: uploadControllerRef.current.signal,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      const uploadResult = await uploadResponse.json();
      const eventId = uploadResult.eventId;
      currentEventIdRef.current = eventId;

      console.log('Upload successful, eventId:', eventId);

      // Trigger processing
      const processResponse = await fetch(`/api/audio/process/${eventId}`, {
        method: 'POST',
        signal: uploadControllerRef.current.signal,
      });

      if (!processResponse.ok) {
        throw new Error(`Processing failed: ${processResponse.statusText}`);
      }

      const processResult = await processResponse.json();
      console.log('Processing result:', processResult);

      if (!processResult.success) {
        throw new Error(processResult.error || 'Error al procesar el audio');
      }

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Upload cancelled');
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Error al subir el audio';
      setError(errorMessage);
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
      uploadControllerRef.current = null;
    }
  };

  return {
    startRecording,
    stopRecording,
    isRecording,
    isUploading,
    error,
  };
}


