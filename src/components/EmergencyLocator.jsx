import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  Rating,
  Chip,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Drawer,
  Divider,
  Slider,
  Tooltip,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  AlertTitle,
} from '@mui/material';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import DirectionsIcon from '@mui/icons-material/Directions';
import PhoneIcon from '@mui/icons-material/Phone';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import TranslateIcon from '@mui/icons-material/Translate';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import EmergencyShareIcon from '@mui/icons-material/Share';
import AmbulanceIcon from '@mui/icons-material/LocalShipping';
import WheelchairIcon from '@mui/icons-material/Accessible';
import { useGeolocation } from '../hooks/useGeolocation';
import { HospitalService } from '../services/HospitalService';
import { EMERGENCY_NUMBERS, LANGUAGES } from '../constants';

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

function EmergencyLocator() {
  // Refs
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markersRef = useRef([]);
  const hospitalServiceRef = useRef(null);
  
  // State
  const [mapsLoaded, setMapsLoaded] = useState(true);
  const { location: userLocation, error: geoError, loading: geoLoading, getLocation, requestPermission, permissionStatus } = useGeolocation();
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [hospitalDetails, setHospitalDetails] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [radius, setRadius] = useState(5);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [showEmergencyNumbers, setShowEmergencyNumbers] = useState(false);
  const [showWheelchairRoutes, setShowWheelchairRoutes] = useState(false);
  const [showPharmacies, setShowPharmacies] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [pharmacies, setPharmacies] = useState([]);
  const [routeCoordinates, setRouteCoordinates] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);

  const mapContainerStyle = {
    width: '100%',
    height: '50vh',
  };

  // Define all functions first
  const handleHospitalClick = useCallback((hospital) => {
    console.log('Hospital clicked:', hospital.name);
    setSelectedHospital(hospital);
    setHospitalDetails(hospital);
    setShowDetails(true);
  }, []);

  const handleGetDirections = useCallback((destination) => {
    if (!userLocation || !destination) return;
    
    setSelectedDestination(destination);
    
    // In a real app, we would call a routing API here
    // For now, we'll just create a simple straight line
    const routePoints = [
      [userLocation.lat, userLocation.lng],
      [destination.location.lat, destination.location.lng]
    ];
    
    setRouteCoordinates(routePoints);
  }, [userLocation]);

  const getDirections = useCallback((hospital) => {
    if (userLocation) {
      handleGetDirections(hospital);
    }
  }, [userLocation, handleGetDirections]);

  const handleShare = useCallback(async (hospital) => {
    try {
      const shareData = {
        title: 'Hospital Location',
        text: `${hospital.name} - ${hospital.address}`,
        url: `https://www.openstreetmap.org/?mlat=${hospital.location.lat}&mlon=${hospital.location.lng}&zoom=16`,
      };
      await navigator.share(shareData);
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, []);

  const handlePermissionRequest = useCallback(async () => {
    setShowPermissionDialog(false);
    setLoading(true);
    setError(null);
    
    try {
      console.log('Requesting user location directly...');
      // First, try to trigger the native permission prompt
      const getPositionPromise = new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp
            });
          },
          (error) => {
            reject(error);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      });

      const location = await getPositionPromise;
      console.log('Location response:', location);

      try {
        console.log('Searching for nearby hospitals with location:', location);
        const nearbyHospitals = await hospitalServiceRef.current.findNearbyHospitals(location);
        console.log('Nearby hospitals response:', {
          count: nearbyHospitals?.length,
          hospitals: nearbyHospitals?.map(h => ({
            name: h.name,
            distance: h.distance,
            location: h.location
          }))
        });

        if (nearbyHospitals.length === 0) {
          console.log('No hospitals found in the area');
          setError('No hospitals found in your area. Try increasing the search radius.');
        } else {
          console.log(`Found ${nearbyHospitals.length} hospitals`);
          setHospitals(nearbyHospitals);
        }
      } catch (error) {
        console.error('Hospital search error:', error);
        setError(error.message || 'Error finding nearby hospitals. Please try again.');
      }
    } catch (error) {
      console.error('Location error:', error);
      let errorMessage;
      
      // Handle specific geolocation errors
      if (error && error.code) {
        switch (error.code) {
          case 1: // PERMISSION_DENIED
            errorMessage = 'Location access was denied. To use this feature:\n' +
              '1. On iOS: Go to Settings > Privacy > Location Services\n' +
              '2. On Android: Go to Settings > Location\n' +
              '3. Enable location services for your browser';
            break;
          case 2: // POSITION_UNAVAILABLE
            errorMessage = 'Location information is unavailable. Please check if your device has location services enabled.';
            break;
          case 3: // TIMEOUT
            errorMessage = 'Location request timed out. Please check your connection and try again.';
            break;
          default:
            errorMessage = 'Could not access your location. Please enable location services and try again.';
        }
      } else {
        errorMessage = 'Could not access your location. Please enable location services and try again.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLocateMe = useCallback(async () => {
    console.log('Starting location search...');
    setLoading(true);
    setError(null);
    
    if (!userLocation && (permissionStatus === 'prompt' || permissionStatus === 'unknown')) {
      setShowPermissionDialog(true);
      setLoading(false);
      return;
    }
    
    try {
      const location = userLocation || await requestPermission();
      if (!location) {
        setError('Could not get your location. Please enable location services and try again.');
        return;
      }

      console.log('Searching for nearby hospitals with location:', location);
      const nearbyHospitals = await hospitalServiceRef.current.findNearbyHospitals(location);
      
      if (nearbyHospitals.length === 0) {
        setError('No hospitals found in your area. Try increasing the search radius.');
      } else {
        setHospitals(nearbyHospitals);
      }
    } catch (error) {
      console.error('Error:', error);
      if (error.message.includes('denied')) {
        setError(
          'Location access was denied. To use this feature:' +
          '\n1. On iOS: Go to Settings > Privacy > Location Services' +
          '\n2. On Android: Go to Settings > Location' +
          '\n3. Enable location services for your browser'
        );
      } else {
        setError('Could not access your location. Please enable location services and try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [userLocation, permissionStatus, requestPermission]);

  const handleShowPharmacies = useCallback(async () => {
    if (!userLocation) {
      setError('Please locate yourself first to find nearby pharmacies');
      return;
    }

    setLoading(true);
    try {
      const nearbyPharmacies = await hospitalServiceRef.current.findNearbyPharmacies(userLocation);
      setPharmacies(nearbyPharmacies);
      setShowPharmacies(true);
    } catch (error) {
      console.error('Error finding pharmacies:', error);
      setError('Failed to find nearby pharmacies');
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

  const addMapLegend = useCallback((map) => {
    // Create a legend control
    const legend = L.control({ position: 'bottomright' });
    
    legend.onAdd = function() {
      const div = L.DomUtil.create('div', 'info legend');
      div.style.backgroundColor = 'white';
      div.style.padding = '10px';
      div.style.borderRadius = '5px';
      div.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
      
      div.innerHTML = `
        <div style="margin-bottom: 5px;"><strong>Legend</strong></div>
        <div style="display: flex; align-items: center; margin-bottom: 5px;">
          <div style="background-color: #2196f3; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; margin-right: 5px;"></div>
          <span>Your Location</span>
        </div>
        <div style="display: flex; align-items: center; margin-bottom: 5px;">
          <div style="background-color: #e53935; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; margin-right: 5px;"></div>
          <span>Hospital</span>
        </div>
        <div style="display: flex; align-items: center;">
          <div style="background-color: #4caf50; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; margin-right: 5px;"></div>
          <span>Pharmacy</span>
        </div>
      `;
      
      return div;
    };
    
    legend.addTo(map);
    return legend;
  }, []);

  // Derived state
  const filteredHospitals = useMemo(() => {
    return hospitals.filter(hospital => {
      const matchesSearch = hospital.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          hospital.address.toLowerCase().includes(searchTerm.toLowerCase());
      
      const withinRadius = hospital.distance <= radius;
      return matchesSearch && withinRadius;
    });
  }, [hospitals, searchTerm, radius]);

  const filteredPharmacies = useMemo(() => {
    return pharmacies.filter(pharmacy => {
      const matchesSearch = pharmacy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            pharmacy.address.toLowerCase().includes(searchTerm.toLowerCase());
      
      const withinRadius = pharmacy.distance <= radius;
      return matchesSearch && withinRadius;
    });
  }, [pharmacies, searchTerm, radius]);

  // Effects
  useEffect(() => {
    if (!hospitalServiceRef.current) {
      console.log('Creating new HospitalService instance');
      hospitalServiceRef.current = new HospitalService();
    }
  }, []);

  // Map initialization effect
  useEffect(() => {
    if (userLocation && mapContainerRef.current) {
      // Initialize map if it doesn't exist
      if (!leafletMapRef.current) {
        leafletMapRef.current = L.map(mapContainerRef.current).setView(
          [userLocation.lat, userLocation.lng], 
          14
        );
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(leafletMapRef.current);
        
        // Add legend
        const legend = addMapLegend(leafletMapRef.current);
        markersRef.current.push(legend);
      } else {
        // Update map view if it already exists
        leafletMapRef.current.setView([userLocation.lat, userLocation.lng], 14);
      }
      
      // Clear existing markers
      markersRef.current.forEach(marker => {
        if (leafletMapRef.current) {
          leafletMapRef.current.removeLayer(marker);
        }
      });
      markersRef.current = [];
      
      // Add user marker
      const userMarker = L.marker([userLocation.lat, userLocation.lng], {
        icon: L.divIcon({
          className: 'user-marker',
          html: '<div style="background-color: #2196f3; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        })
      })
        .addTo(leafletMapRef.current)
        .bindPopup('Your Location')
        .openPopup();
      
      markersRef.current.push(userMarker);
      
      // Add radius circle
      const radiusCircle = L.circle([userLocation.lat, userLocation.lng], {
        radius: radius * 1000,
        color: '#e53935',
        fillColor: '#e53935',
        fillOpacity: 0.1
      }).addTo(leafletMapRef.current);
      
      markersRef.current.push(radiusCircle);
      
      // Add hospital markers
      filteredHospitals.forEach(hospital => {
  const hospitalIcon = L.divIcon({
    className: 'hospital-marker',
    html: '<div style="background-color: #e53935; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  const marker = L.marker([hospital.location.lat, hospital.location.lng], {
    icon: hospitalIcon
  })
    .addTo(leafletMapRef.current)
    .bindPopup(`
      <div>
        <h4>${hospital.name}</h4>
        <p>${hospital.address}</p>
        <p>Distance: ${hospital.distance} km</p>
      </div>
    `);

  marker.on('click', () => {
    handleHospitalClick(hospital);
  });

  markersRef.current.push(marker);
});

// Add pharmacy markers if showPharmacies is true and we have filtered pharmacies
if (showPharmacies && filteredPharmacies.length > 0) {
  filteredPharmacies.forEach(pharmacy => {
    const pharmacyIcon = L.divIcon({
      className: 'pharmacy-marker',
      html: '<div style="background-color: #4caf50; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    const marker = L.marker([pharmacy.location.lat, pharmacy.location.lng], {
      icon: pharmacyIcon
    })
      .addTo(leafletMapRef.current)
      .bindPopup(`
        <div>
          <h4>${pharmacy.name}</h4>
          <p>${pharmacy.address}</p>
          <p>Distance: ${pharmacy.distance} km</p>
          <p>Hours: ${pharmacy.opening_hours}</p>
        </div>
      `);

    markersRef.current.push(marker);
  });
}

      // Add route if routeCoordinates is set
      if (routeCoordinates) {
        const routeLine = L.polyline(routeCoordinates, {
          color: '#2196f3',
          weight: 4,
          opacity: 0.7,
          dashArray: '10, 10'
        }).addTo(leafletMapRef.current);
        
        markersRef.current.push(routeLine);
        
        // Fit map to show the entire route
        leafletMapRef.current.fitBounds(routeLine.getBounds(), {
          padding: [50, 50]
        });
      }
    }
    
    // Cleanup function
    return () => {
      if (leafletMapRef.current) {
        // Clean up markers on unmount
        markersRef.current.forEach(marker => {
          if (leafletMapRef.current) {
            leafletMapRef.current.removeLayer(marker);
          }
        });
      }
    };
  }, [userLocation, filteredHospitals, radius, showPharmacies, pharmacies, routeCoordinates, addMapLegend, handleHospitalClick]);

  const speedDialActions = [
    { icon: <FilterListIcon />, name: 'Distance', onClick: () => setShowFilters(true) },
    { icon: <TranslateIcon />, name: 'Language', onClick: () => setShowLanguage(true) },
    { icon: <PhoneIcon />, name: 'Emergency Numbers', onClick: () => setShowEmergencyNumbers(true) },
    { icon: <LocalPharmacyIcon />, name: 'Show Pharmacies', onClick: handleShowPharmacies },
  ];

  // Add Permission Dialog component
  const PermissionDialog = () => (
    <Dialog
      open={showPermissionDialog}
      onClose={() => setShowPermissionDialog(false)}
      aria-labelledby="permission-dialog-title"
    >
      <DialogTitle id="permission-dialog-title">
        Enable Location Services
      </DialogTitle>
      <DialogContent>
        <Box sx={{ p: 2 }}>
          <Typography variant="body1" gutterBottom>
            To find hospitals near you, we need access to your location. This helps us:
          </Typography>
          <List>
            <ListItem>
              <ListItemText primary="• Find the closest emergency facilities" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Show accurate travel times" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Provide turn-by-turn directions" />
            </ListItem>
          </List>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Your location is only used while you're using the app and is never stored.
          </Typography>
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
            <Button
              onClick={() => setShowPermissionDialog(false)}
              color="inherit"
            >
              Not Now
            </Button>
            <Button
              onClick={handlePermissionRequest}
              variant="contained"
              color="primary"
              startIcon={<MyLocationIcon />}
            >
              Allow Location Access
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );

  // Add error display component with platform-specific instructions
  const LocationErrorAlert = ({ error }) => {
    if (!error) return null;
    
    return (
      <Alert 
        severity="error" 
        sx={{ mb: 2 }}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={handleLocateMe}
          >
            Try Again
          </Button>
        }
      >
        <AlertTitle>Location Error</AlertTitle>
        {error.split('\n').map((line, i) => (
          <Typography key={i} variant="body2">
            {line}
          </Typography>
        ))}
      </Alert>
    );
  };

  return (
    <Container maxWidth="lg">
      {/* Add the permission dialog */}
      <PermissionDialog />
      
      {/* Show location error with platform-specific instructions */}
      <LocationErrorAlert error={error} />
      
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Emergency Hospital Locator
        </Typography>

        {!mapsLoaded ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Search Bar */}
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search hospitals by name or address"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />

            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<MyLocationIcon />}
              onClick={handleLocateMe}
              fullWidth
              sx={{ mb: 3, py: 2 }}
            >
              {loading || geoLoading ? (
                <CircularProgress color="inherit" size={24} />
              ) : (
                'Locate Nearest Hospital'
              )}
            </Button>

            {userLocation && (
              <Paper elevation={3} sx={{ mb: 3 }}>
                <div 
                  ref={mapContainerRef} 
                  style={mapContainerStyle}
                ></div>
              </Paper>
            )}

            {/* Hospital List */}
            {filteredHospitals.length > 0 && (
              <Paper elevation={3}>
                <List>
                  {filteredHospitals.map((hospital) => (
                    <ListItem
                      key={hospital.id}
                      divider
                      onClick={() => handleHospitalClick(hospital)}
                      secondaryAction={
                        <Box>
                          <IconButton
                            edge="end"
                            aria-label="directions"
                            onClick={(e) => {
                              e.stopPropagation();
                              getDirections(hospital);
                            }}
                          >
                            <DirectionsIcon />
                          </IconButton>
                          <IconButton
                            edge="end"
                            aria-label="share"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShare(hospital);
                            }}
                          >
                            <EmergencyShareIcon />
                          </IconButton>
                          {hospital.phone && (
                            <IconButton
                              edge="end"
                              aria-label="call"
                              href={`tel:${hospital.phone}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <PhoneIcon />
                            </IconButton>
                          )}
                        </Box>
                      }
                      sx={{ cursor: 'pointer' }}
                    >
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center">
                            <LocalHospitalIcon color="error" sx={{ mr: 1 }} />
                            <Typography component="span">{hospital.name}</Typography>
                            {hospital.traumaLevel && (
                              <Chip
                                label={`Level ${hospital.traumaLevel} Trauma`}
                                color="warning"
                                size="small"
                                sx={{ ml: 1 }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" component="span" display="block">
                              {hospital.address}
                            </Typography>
                            <Box display="flex" alignItems="center" mt={0.5}>
                              <Typography variant="body2" component="span">
                                Distance: {hospital.distance} km
                              </Typography>
                              {hospital.rating && (
                                <>
                                  <Typography variant="body2" component="span" mx={1}>
                                    |
                                  </Typography>
                                  <Rating value={hospital.rating} readOnly size="small" />
                                </>
                              )}
                            </Box>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}

            {/* Pharmacy List */}
            {showPharmacies && pharmacies.length > 0 && (
              <Paper elevation={3} sx={{ mt: 3 }}>
                <Box sx={{ p: 2, bgcolor: '#4caf50', color: 'white' }}>
                  <Typography variant="h6">Nearby Pharmacies</Typography>
                </Box>
                <List>
                  {pharmacies.map((pharmacy) => (
                    <ListItem
                      key={pharmacy.id}
                      divider
                      secondaryAction={
                        <Box>
                          <IconButton
                            edge="end"
                            aria-label="directions"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGetDirections(pharmacy);
                            }}
                          >
                            <DirectionsIcon />
                          </IconButton>
                          {pharmacy.phone && (
                            <IconButton
                              edge="end"
                              aria-label="call"
                              href={`tel:${pharmacy.phone}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <PhoneIcon />
                            </IconButton>
                          )}
                        </Box>
                      }
                      sx={{ cursor: 'pointer' }}
                    >
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center">
                            <LocalPharmacyIcon color="success" sx={{ mr: 1 }} />
                            <Typography component="span">{pharmacy.name}</Typography>
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" component="span" display="block">
                              {pharmacy.address}
                            </Typography>
                            <Box display="flex" alignItems="center" mt={0.5}>
                              <Typography variant="body2" component="span">
                                Distance: {pharmacy.distance} km
                              </Typography>
                              <Typography variant="body2" component="span" mx={1}>
                                |
                              </Typography>
                              <Typography variant="body2" component="span">
                                {pharmacy.opening_hours}
                              </Typography>
                            </Box>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}

            {/* Filters Drawer */}
            <Drawer
              anchor="right"
              open={showFilters}
              onClose={() => setShowFilters(false)}
            >
              <Box sx={{ width: 300, p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  distance filter
                </Typography>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <Typography gutterBottom>Search Radius: {radius} km</Typography>
                  <Slider
                    value={radius}
                    onChange={(_, newValue) => setRadius(newValue)}
                    min={1}
                    max={20}
                    valueLabelDisplay="auto"
                  />
                </FormControl>
                
                
              </Box>
            </Drawer>

            {/* Emergency Numbers Dialog */}
            <Dialog
              open={showEmergencyNumbers}
              onClose={() => setShowEmergencyNumbers(false)}
            >
              <DialogTitle>Emergency Numbers</DialogTitle>
              <DialogContent>
                <List>
                  {Object.entries(EMERGENCY_NUMBERS).map(([service, number]) => (
                    <ListItem key={service}>
                      <ListItemText primary={service} secondary={number} />
                      <IconButton href={`tel:${number}`}>
                        <PhoneIcon />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
              </DialogContent>
            </Dialog>

            {/* Hospital Details Dialog */}
            <Dialog
              open={showDetails}
              onClose={() => setShowDetails(false)}
              maxWidth="md"
              fullWidth
            >
              {hospitalDetails && (
                <>
                  <DialogTitle>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      {hospitalDetails.name}
                      {hospitalDetails.emergency && (
                        <Chip
                          icon={<AmbulanceIcon />}
                          label="Emergency Unit"
                          color="error"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </DialogTitle>
                  <DialogContent>
                    <Box sx={{ py: 2 }}>
                      <Typography variant="body1" gutterBottom>
                        {hospitalDetails.address}
                      </Typography>
                      {hospitalDetails.phone && (
                        <Typography variant="body1" gutterBottom>
                          Phone: {hospitalDetails.phone}
                        </Typography>
                      )}
                      {hospitalDetails.rating && (
                        <Box display="flex" alignItems="center" sx={{ mb: 2 }}>
                          <Typography variant="body1" component="span" sx={{ mr: 1 }}>
                            Rating:
                          </Typography>
                          <Rating value={hospitalDetails.rating} readOnly precision={0.1} />
                          <Typography variant="body2" component="span" sx={{ ml: 1 }}>
                            ({hospitalDetails.rating})
                          </Typography>
                        </Box>
                      )}
                      {hospitalDetails.opening_hours && (
                        <>
                          <Typography variant="h6" gutterBottom>
                            Opening Hours
                          </Typography>
                          <Typography variant="body2">
                            {hospitalDetails.opening_hours}
                          </Typography>
                        </>
                      )}
                      {hospitalDetails.website && (
                        <Button
                          variant="outlined"
                          color="primary"
                          href={hospitalDetails.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ mt: 2 }}
                        >
                          Visit Website
                        </Button>
                      )}
                    </Box>
                  </DialogContent>
                </>
              )}
            </Dialog>

            {/* Speed Dial for Quick Actions */}
            <SpeedDial
              ariaLabel="Quick actions"
              sx={{ position: 'fixed', bottom: 16, right: 16 }}
              icon={<SpeedDialIcon />}
            >
              {speedDialActions.map((action) => (
                <SpeedDialAction
                  key={action.name}
                  icon={action.icon}
                  tooltipTitle={action.name}
                  onClick={action.onClick}
                />
              ))}
            </SpeedDial>

            {/* Language Selection Dialog */}
            <Dialog
              open={showLanguage}
              onClose={() => setShowLanguage(false)}
            >
              <DialogTitle>Select Language</DialogTitle>
              <DialogContent>
                <List>
                  {LANGUAGES.map((lang) => (
                    <ListItem
                      key={lang.code}
                      button
                      selected={selectedLanguage === lang.code}
                      onClick={() => {
                        setSelectedLanguage(lang.code);
                        setShowLanguage(false);
                      }}
                    >
                      <ListItemText primary={lang.name} />
                    </ListItem>
                  ))}
                </List>
              </DialogContent>
            </Dialog>
          </>
        )}
      </Box>
    </Container>
  );
}

export default EmergencyLocator; 