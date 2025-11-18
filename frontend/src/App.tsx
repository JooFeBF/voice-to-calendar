import { useState, useEffect, useRef } from 'react';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { useEventPoller } from './hooks/useEventPoller';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import './App.css';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState<boolean | null>(null);
  const [permissionMessage, setPermissionMessage] = useState<string>('');
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');
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

  // Check permission status without requesting (non-blocking)
  useEffect(() => {
    const checkPermissionStatus = async () => {
      // Check if Permissions API is available
      if ('permissions' in navigator && 'query' in navigator.permissions) {
        try {
          // Type assertion needed for microphone permission name
          const result = await (navigator.permissions as any).query({ name: 'microphone' as PermissionName });
          setPermissionState(result.state);
          
          if (result.state === 'granted') {
            setPermissionsGranted(true);
            setPermissionMessage('');
          } else if (result.state === 'denied') {
            setPermissionsGranted(false);
            setPermissionMessage('Los permisos de micrófono están denegados. Por favor, habilítalos en la configuración de tu navegador.');
          } else {
            // 'prompt' state - permissions not yet requested
            setPermissionsGranted(null);
            setPermissionMessage('Presiona el botón para permitir el acceso al micrófono.');
          }

          // Listen for permission changes
          result.onchange = () => {
            setPermissionState(result.state);
            if (result.state === 'granted') {
              setPermissionsGranted(true);
              setPermissionMessage('');
            } else if (result.state === 'denied') {
              setPermissionsGranted(false);
              setPermissionMessage('Los permisos de micrófono están denegados. Por favor, habilítalos en la configuración de tu navegador.');
            }
          };
        } catch (error) {
          // Permissions API might not support 'microphone' in all browsers
          console.log('Permissions API not fully supported, will check on user interaction');
          setPermissionState('unknown');
          setPermissionsGranted(null);
        }
      } else {
        // Permissions API not available, check on user interaction
        setPermissionState('unknown');
        setPermissionsGranted(null);
        setPermissionMessage('Presiona el botón para permitir el acceso al micrófono.');
      }
    };

    checkPermissionStatus();
  }, []);

  // Auto-play audio when event is available and not recording
  useEffect(() => {
    if (hasEvent && eventData && !isRecording && !isPlaying) {
      playAudio(eventData.eventId);
    }
  }, [hasEvent, eventData, isRecording, isPlaying, playAudio]);

  const handlePressStart = async (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Request permissions on user gesture (required for mobile browsers)
    if (permissionsGranted !== true) {
      try {
        // Request microphone permission - this must be in response to user gesture
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000,
          } 
        });
        
        // Permission granted - stop the test stream
        stream.getTracks().forEach(track => track.stop());
        setPermissionsGranted(true);
        setPermissionState('granted');
        setPermissionMessage('');
      } catch (error: any) {
        // Handle different error types
        let errorMessage = 'No se pueden obtener los permisos de micrófono.';
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          errorMessage = 'Permisos de micrófono denegados. Por favor, habilítalos en la configuración de tu navegador y recarga la página.';
          setPermissionState('denied');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          errorMessage = 'No se encontró ningún micrófono. Por favor, conecta un micrófono e intenta de nuevo.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          errorMessage = 'El micrófono está siendo usado por otra aplicación. Por favor, cierra otras aplicaciones e intenta de nuevo.';
        } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
          errorMessage = 'El micrófono no cumple con los requisitos. Por favor, intenta con otro dispositivo.';
        } else if (error.name === 'SecurityError') {
          errorMessage = 'Error de seguridad. La página debe estar servida sobre HTTPS o localhost. Para desarrollo, usa localhost o habilita HTTPS en Vite.';
        } else if (error.name === 'TypeError') {
          errorMessage = 'getUserMedia no está disponible. Asegúrate de usar un navegador compatible. Nota: localhost funciona sin HTTPS.';
        }
        
        setPermissionsGranted(false);
        setPermissionMessage(errorMessage);
        console.error('Permission error:', error);
        return;
      }
    }

    if (isUploading || isPlaying) {
      return;
    }

    touchStartRef.current = Date.now();
    setIsRecording(true);
    await startRecording();
  };

  const handlePressEnd = async (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
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
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        onTouchCancel={handlePressEnd}
        onTouchMove={(e) => {
          // Prevent scrolling when touching the button
          e.preventDefault();
        }}
        disabled={isUploading || isPlaying}
        type="button"
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
          ) : permissionsGranted === false ? (
            <span className="button-text">Permisos denegados - Toca para intentar de nuevo</span>
          ) : permissionsGranted === null ? (
            <span className="button-text">Toca para permitir el micrófono</span>
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


