import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Importiert globale CSS-Stile
import App from './App'; // Die Hauptkomponente der Anwendung
import reportWebVitals from './reportWebVitals'; // Für die Leistungsmessung
import { CssBaseline } from '@mui/material'; // Stellt ein einheitliches Baseline-Styling bereit

// Erstellt einen Root-Container für die React-Anwendung
const root = ReactDOM.createRoot(document.getElementById('root'));

// Rendert die Anwendung in den Root-Container
root.render(
  <React.StrictMode>
    {/* CssBaseline stellt ein konsistentes Styling für die Anwendung bereit */}
    <CssBaseline />
    {/* Die Hauptkomponente der Anwendung */}
    <App />
  </React.StrictMode>
);

// Misst die Leistung der Anwendung (optional)
reportWebVitals(); 