import { useState, useCallback, useEffect } from 'react';

// Custom Hook zur Verwaltung der Geolocation
export const useGeolocation = () => {
  // Zustand für Standort, Fehler, Ladezustand und Berechtigungsstatus
  const [state, setState] = useState({
    location: null,
    error: null,
    loading: false,
    permissionStatus: 'unknown', // 'granted', 'denied', 'prompt', 'unknown'
  });

  // Überprüft den Berechtigungsstatus beim Mounten der Komponente
  useEffect(() => {
    checkPermissionStatus();
  }, []);

  // Funktion zur Überprüfung des Berechtigungsstatus
  const checkPermissionStatus = useCallback(async () => {
    if (!navigator.permissions || !navigator.permissions.query) {
      // Ältere Browser unterstützen die Permissions API nicht
      return;
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      setState(prev => ({
        ...prev,
        permissionStatus: result.state
      }));

      // Listener für Änderungen des Berechtigungsstatus
      result.addEventListener('change', () => {
        setState(prev => ({
          ...prev,
          permissionStatus: result.state
        }));
      });
    } catch (error) {
      console.error('Fehler beim Überprüfen der Geolocation-Berechtigung:', error);
    }
  }, []);

  // Fordert explizit die Berechtigung an
  const requestPermission = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    
    try {
      // Löst den Berechtigungsdialog aus, falls noch nicht erteilt
      const location = await getLocationPromise();
      return location;
    } finally {
      await checkPermissionStatus();
    }
  }, []);

  // Hilfsfunktion, die ein Promise für die Geolocation zurückgibt
  const getLocationPromise = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = 'Geolocation wird von deinem Browser nicht unterstützt';
        setState(prev => ({
          ...prev,
          error,
          loading: false,
        }));
        reject(new Error(error));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };
          setState(prev => ({
            ...prev,
            location,
            loading: false,
            error: null,
          }));
          resolve(location);
        },
        (error) => {
          let errorMessage;
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Standortberechtigung verweigert. Bitte aktiviere die Standortdienste in den Geräteeinstellungen.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Standortinformationen sind nicht verfügbar. Bitte versuche es später erneut.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Die Standortanfrage hat das Zeitlimit überschritten. Bitte überprüfe deine Verbindung und versuche es erneut.';
              break;
            default:
              errorMessage = 'Ein unbekannter Fehler ist beim Abrufen deines Standorts aufgetreten.';
          }
          
          setState(prev => ({
            ...prev,
            error: errorMessage,
            loading: false,
          }));
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true, // Hohe Genauigkeit aktivieren
          timeout: 10000, // Timeout nach 10 Sekunden
          maximumAge: 0, // Keine Cache-Nutzung
        }
      );
    });
  }, []);

  // Funktion zum Abrufen des Standorts
  const getLocation = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      return await getLocationPromise();
    } catch (error) {
      // Fehler wird bereits im Zustand gesetzt
      return null;
    }
  }, [getLocationPromise]);

  // Rückgabe der Hook-Funktionen und Zustände
  return {
    location: state.location,
    error: state.error,
    loading: state.loading,
    permissionStatus: state.permissionStatus,
    getLocation,
    requestPermission,
    checkPermissionStatus,
  };
};