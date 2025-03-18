import React from 'react';
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material';
import './App.css';
import EmergencyLocator from './components/EmergencyLocator';


// Erstellt ein benutzerdefiniertes Theme für die Anwendung
const theme = createTheme({
  palette: {
    primary: {
      main: '#e53935', // Rot für Notfälle
      light: '#ff6f60',
      dark: '#ab000d',
    },
    secondary: {
      main: '#2196f3', // Blau für Informationen
      light: '#6ec6ff',
      dark: '#0069c0',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif', // Schriftart der Anwendung
  },
});

// Die Hauptkomponente der Anwendung
function App() {
  return (
    <ThemeProvider theme={theme}>
    {/* CssBaseline stellt ein konsistentes Styling für die Anwendung bereit */}
      <CssBaseline />
      <div className="App">
      {/* Die EmergencyLocator-Komponente, die die Standortermittlung und Anzeige der Krankenhäuser und Apotheken übernimmt */}
        <EmergencyLocator />
      </div>
    </ThemeProvider>
  );
}

export default App; 