

// Service-Klasse zur Verwaltung von Krankenhaus- und Apothekendaten
export class HospitalService {
  static RADIUS = 50000; // 50 km Radius

  constructor() {
    console.log('Initialisiere HospitalService mit OpenStreetMap');
  }

  // Findet nahegelegene Krankenhäuser basierend auf dem Standort
  async findNearbyHospitals(location) {
    console.log('Suche nahegelegene Krankenhäuser für Standort:', location);
    try {
      if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
        throw new Error('Ungültiger Standort angegeben');
      }

      // Overpass API-Abfrage, um Krankenhäuser zu finden
      const query = `
      [out:json][timeout:50];
      (
        node["amenity"="hospital"](around:50000,${location.lat},${location.lng});
        way["amenity"="hospital"](around:50000,${location.lat},${location.lng});
        relation["amenity"="hospital"](around:50000,${location.lat},${location.lng});
      );
      out center;
      `;
      try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: query,
        });

        if (!response.ok) {
          console.error('Overpass API-Fehler:', response.status, response.statusText);
          throw new Error(`Fehler beim Abrufen der Krankenhäuser von OpenStreetMap: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data || !data.elements) {
          console.error('Ungültiges Datenformat von der Overpass API:', data);
          throw new Error('Ungültiges Datenformat von OpenStreetMap erhalten');
        }
        
        const hospitals = this.processOverpassResults(data.elements, location);

        if (hospitals.length === 0) {
          console.warn('Keine Krankenhäuser in der Umgebung gefunden');
        } else {
          console.log(`Gefundene Krankenhäuser: ${hospitals.length}`);
        }

        // Sortiere nach Entfernung
        return hospitals.sort((a, b) => a.distance - b.distance);
      } catch (fetchError) {
        console.error('Fetch-Fehler:', fetchError);
        
        // Verwende Mock-Daten für Tests, wenn die API fehlschlägt
        if (process.env.NODE_ENV === 'development') {
          console.warn('Verwende Mock-Krankenhausdaten aufgrund eines API-Fehlers');
          return this.getMockHospitals(location);
        }
        
        throw fetchError;
      }
    } catch (error) {
      console.error('Fehler in findNearbyHospitals:', error);
      throw error;
    }
  }

  // Verarbeitet die Ergebnisse der Overpass API
  processOverpassResults(elements, userLocation) {
    if (!elements || !Array.isArray(elements)) {
      console.warn('Ungültige Elemente-Daten erhalten:', elements);
      return [];
    }

    return elements
      .filter(element => element && element.tags && element.tags.amenity === 'hospital')
      .map(element => {
        try {
          const location = this.getElementLocation(element);
          return {
            id: element.id || `hospital-${Math.random().toString(36).substr(2, 9)}`,
            name: element.tags.name || 'Unbenanntes Krankenhaus',
            location: {
              lat: location.lat,
              lng: location.lng,
            },
            distance: this.calculateDistance(userLocation, location),
            address: this.formatAddress(element.tags),
            phone: element.tags['phone'] || null,
            website: element.tags.website || null,
            emergency: element.tags.emergency === 'yes',
            wheelchair: element.tags.wheelchair || 'unknown',
            opening_hours: element.tags.opening_hours || null,
            services: this.extractServices(element.tags),
          };
        } catch (error) {
          console.error('Fehler beim Verarbeiten des Krankenhauselements:', error, element);
          return null;
        }
      })
      .filter(hospital => hospital !== null);
  }
  processPharmacyResults(elements, userLocation) {
    if (!elements || !Array.isArray(elements)) {
        console.warn('Ungültige Elemente-Daten erhalten:', elements);
        return [];
    }

    return elements
        .filter(element => element && element.tags && element.tags.amenity === 'pharmacy')
        .map(element => {
            try {
                const location = this.getElementLocation(element);
                const distance = this.calculateDistance(userLocation, location);
                
                return {
                    id: element.id || `pharmacy-${Math.random().toString(36).substr(2, 9)}`,
                    name: element.tags.name || 'Unbenannte Apotheke',
                    location: {
                        lat: location.lat,
                        lng: location.lng,
                    },
                    distance: distance, // Distanz hinzufügen
                    address: this.formatAddress(element.tags),
                    phone: element.tags['phone'] || null,
                    website: element.tags.website || null,
                    opening_hours: element.tags.opening_hours || 'Keine Angabe',
                };
            } catch (error) {
                console.error('Fehler beim Verarbeiten des Apothekenelements:', error, element);
                return null;
            }
        })
        .filter(pharmacy => pharmacy !== null)
        .sort((a, b) => a.distance - b.distance); // Apotheken nach Entfernung sortieren
}
  // Formatiert die Adresse basierend auf den Tags
  formatAddress(tags) {
    if (!tags) return 'Adresse nicht verfügbar';
    
    const street = tags['addr:street'] || '';
    const housenumber = tags['addr:housenumber'] || '';
    const city = tags['addr:city'] || '';
    const postcode = tags['addr:postcode'] || '';
    
    if (street && housenumber) {
      return `${street} ${housenumber}${city ? ', ' + city : ''}${postcode ? ' ' + postcode : ''}`;
    } else if (street) {
      return `${street}${city ? ', ' + city : ''}${postcode ? ' ' + postcode : ''}`;
    } else if (tags.address) {
      return tags.address;
    }
    
    return 'Adresse nicht verfügbar';
  }

  // Ermittelt die Position eines Elements
  getElementLocation(element) {
    // Für Nodes verwende direkt lat/lon
    if (element.lat !== undefined && element.lon !== undefined) {
      return { lat: element.lat, lng: element.lon };
    }
    
    // Für Ways und Relations verwende den Mittelpunkt, falls verfügbar
    if (element.center && element.center.lat !== undefined && element.center.lon !== undefined) {
      return { lat: element.center.lat, lng: element.center.lon };
    }
    
    // Wenn Tags mit lat/lon vorhanden sind, verwende diese
    if (element.tags && element.tags.lat && element.tags.lon) {
      return { lat: parseFloat(element.tags.lat), lng: parseFloat(element.tags.lon) };
    }
    
    // Für Debugging-Zwecke protokolliere das Element, das das Problem verursacht hat
    console.warn('Element ohne Standortdaten:', element);
    
    // Rückgabe eines Standardstandorts (Berlin Mitte) als Fallback
    return { lat: 52.5200, lng: 13.4050 };
  }

  // Extrahiert die Dienste aus den Tags
  extractServices(tags) {
    const services = new Set();
    
    // Extrahiere aus den Tags
    if (tags.emergency === 'yes') services.add('Notfallversorgung');
    if (tags.wheelchair === 'yes') services.add('Rollstuhlgerecht');
    
    // Extrahiere aus der Beschreibung, falls verfügbar
  }
  

  // Berechnet die Entfernung zwischen zwei Punkten
  calculateDistance(point1, point2) {
    const R = 6371; // Erdradius in Kilometern
    const dLat = this.toRad(point2.lat - point1.lat);
    const dLng = this.toRad(point2.lng - point1.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(point1.lat)) *
        Math.cos(this.toRad(point2.lat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round((R * c) * 10) / 10; // Auf eine Dezimalstelle runden
  }

  // Konvertiert Grad in Radiant
  toRad(degrees) {
    return (degrees * Math.PI) / 180;
  }



  // Findet nahegelegene Apotheken
  async findNearbyPharmacies(location) {
    console.log('Suche nahegelegene Apotheken für Standort:', location);
    try {
        if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
            throw new Error('Ungültiger Standort angegeben');
        }

        // Overpass API-Abfrage für Apotheken
        const query = `
        [out:json][timeout:50];
        (
            node["amenity"="pharmacy"](around:50000,${location.lat},${location.lng});
            way["amenity"="pharmacy"](around:50000,${location.lat},${location.lng});
            relation["amenity"="pharmacy"](around:50000,${location.lat},${location.lng});
        );
        out center;
        `;

        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('Overpass API-Fehler:', response.status, response.statusText);
            throw new Error(`Fehler beim Abrufen der Apotheken von OpenStreetMap: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!data || !data.elements) {
            console.error('Ungültiges Datenformat von der Overpass API:', data);
            throw new Error('Ungültiges Datenformat von OpenStreetMap erhalten');
        }

        const pharmacies = this.processPharmacyResults(data.elements, location);

        if (pharmacies.length === 0) {
            console.warn('Keine Apotheken in der Umgebung gefunden');
        } else {
            console.log(`Gefundene Apotheken: ${pharmacies.length}`);
        }

        return pharmacies.sort((a, b) => a.distance - b.distance);
    } catch (error) {
        console.error('Fehler in findNearbyPharmacies:', error);

        if (process.env.NODE_ENV === 'development') {
            console.warn('Verwende Mock-Apothekendaten aufgrund eines API-Fehlers');
            return this.getMockPharmacies(location);
        }

        throw error;
    }
}

 
} 