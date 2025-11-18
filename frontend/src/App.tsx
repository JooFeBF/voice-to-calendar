import { useState, useEffect, useRef } from 'react';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { useEventPoller } from './hooks/useEventPoller';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import './App.css';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState<boolean | null>(null);
  const [permissionMessage, setPermissionMessage] = useState<string>('');
  const touchStartRef = useRef<number>(0);

  const { 
    startRecording, 
    stopRecording, 
    isUploading,
    error: recordError 
  } = useAudioRecorder();

  const {
    hasEvent,
    eventData,
    isPlaying,
    error: pollError
  } = useEventPoller(!isRecording); // Only poll when not recording

  const {
    play: playAudio,
    error: playError
  } = useAudioPlayer();

  // Check and request permissions on mount
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        // Check microphone permission
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setPermissionsGranted(true);
        setPermissionMessage('');
      } catch (error) {
        setPermissionsGranted(false);
        setPermissionMessage(
          'Se requieren permisos de micrófono y reproducción de audio. Por favor, otorga los permisos cuando se te solicite.'
        );
        console.error('Permission error:', error);
      }
    };

    checkPermissions();
  }, []);

  // Auto-play audio when event is available and not recording
  useEffect(() => {
    if (hasEvent && eventData && !isRecording && !isPlaying) {
      playAudio(eventData.eventId);
    }
  }, [hasEvent, eventData, isRecording, isPlaying, playAudio]);

  const handlePressStart = async () => {
    if (!permissionsGranted) {
      // Try to request permissions again
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setPermissionsGranted(true);
        setPermissionMessage('');
      } catch (error) {
        setPermissionMessage('No se pueden obtener los permisos de micrófono. Verifica la configuración de tu navegador.');
        return;
      }
    }

    touchStartRef.current = Date.now();
    setIsRecording(true);
    await startRecording();
  };

  const handlePressEnd = async () => {
    const pressDuration = Date.now() - touchStartRef.current;
    
    // Minimum press duration of 300ms to avoid accidental taps
    if (pressDuration < 300) {
      setIsRecording(false);
      return;
    }

    setIsRecording(false);
    await stopRecording();
  };

  const errors = [recordError, pollError, playError].filter(Boolean);

  return (
    <div className="app">
      {permissionMessage && (
        <div className="permission-banner">
          {permissionMessage}
        </div>
      )}

      <button
        className={`record-button ${isRecording ? 'recording' : ''} ${isUploading ? 'uploading' : ''}`}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={(e) => {
          e.preventDefault();
          handlePressStart();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          handlePressEnd();
        }}
        disabled={isUploading || isPlaying}
      >
        <div className="button-content">
          {isUploading ? (
            <>
              <div className="spinner"></div>
              <span className="button-text">Procesando...</span>
            </>
          ) : isPlaying ? (
            <>
              <div className="audio-waves">
                <div className="wave"></div>
                <div className="wave"></div>
                <div className="wave"></div>
              </div>
              <span className="button-text">Reproduciendo recordatorio...</span>
            </>
          ) : isRecording ? (
            <>
              <div className="recording-indicator">
                <div className="pulse"></div>
                <div className="recording-dot"></div>
              </div>
              <span className="button-text blinking">Grabando...</span>
            </>
          ) : (
            <span className="button-text">Mantén presionado para recordar</span>
          )}
        </div>
      </button>

      {errors.length > 0 && (
        <div className="error-container">
          {errors.map((error, index) => (
            <div key={index} className="error-message">
              {error}
            </div>
          ))}
        </div>
      )}

      <div className="status-bar">
        {hasEvent && !isRecording && (
          <div className="status-message">
            Recordatorio pendiente detectado
          </div>
        )}
      </div>
    </div>
  );
}

export default App;


