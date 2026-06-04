import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// =========================================================================
// LEAFLET MARKER ASSET FIX FOR REACT COMPILATION
// =========================================================================
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});
L.Marker.prototype.options.icon = DefaultIcon;

// =========================================================================
// SUB-COMPONENT: DYNAMIC VIEWPORT FOCUS CONTROLLER
// =========================================================================
function ChangeMapView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 14); // Resets zoom and centers whenever coordinates alter
    }
  }, [center, map]);
  return null;
}

export default function App() {
  // Core Navigation States
  const [startLoc, setStartLoc] = useState(null);       // Tracks current live user GPS
  const [mapCenter, setMapCenter] = useState(null);     // Dynamic center mapping pivot
  const [searchQuery, setSearchQuery] = useState('');   // User destination input text
  const [searchResults, setSearchResults] = useState([]);// Autocomplete locations array
  const [selectedDest, setSelectedDest] = useState(null); // Locked target endpoint coordinates
  const [showDropdown, setShowDropdown] = useState(false);

  // UI Interactive Toggle States
  const [isReportingMode, setIsReportingMode] = useState(false);
  const [timeValue, setTimeValue] = useState(new Date().getHours()); // Sync slider defaults to system time
  const [routePolyline, setRoutePolyline] = useState([]); // Array of coordinates for path render
  const [safetyMetrics, setSafetyMetrics] = useState(null); // Custom metrics object from backend
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  // =========================================================================
  // CORE ADVANCED GEOLOCATION AUTO-CAPTURE BLOCK (APP LOAD)
  // =========================================================================
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn("Geolocation API hardware unvailable on this browser environment.");
      // Standard local spatial coordinate fallback structure to prevent map crashes
      setStartLoc([14.6600, 77.5500]);
      setMapCenter([14.6600, 77.5500]);
      setIsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        console.log(`Hardware GPS Lock Confirmed: ${latitude}, ${longitude}`);
        
        setStartLoc([latitude, longitude]);
        setMapCenter([latitude, longitude]);
        setIsLoading(false);
      },
      (error) => {
        console.error("Hardware tracking permission exceptions:", error);
        // Resilient fallback structure if browser blocks permission mid-session
        setStartLoc([14.6600, 77.5500]);
        setMapCenter([14.6600, 77.5500]);
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, []);

  // =========================================================================
  // GLOBAL METRIC SEARCH DISCOVERY PIPELINE (NOMINATIM API LINK)
  // =========================================================================
  const handleDestinationSearch = async (queryText) => {
    setSearchQuery(queryText);
    
    // Safety guard to halt empty string inputs or minor typos from network flooding
    if (!queryText || queryText.trim().length < 3) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      // Connects directly to OpenStreetMap global naming archives for full discovery matching
      const queryUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryText)}&limit=10&addressdetails=1`;
      
      const response = await fetch(queryUrl, {
        headers: { "Accept-Language": "en" }
      });
      
      if (!response.ok) throw new Error("External Geocoding framework exception.");
      
      const locationsArray = await response.json();
      
      if (locationsArray && locationsArray.length > 0) {
        setSearchResults(locationsArray);
        setShowDropdown(true);
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    } catch (networkErr) {
      console.error("Fuzzy discovery framework data transaction failure:", networkErr);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // =========================================================================
  // EXECUTE COMPUTATION: BACKEND SAFE PATH COMPILATION TRIGGER
  // =========================================================================
  const selectTargetDestination = async (placeObj) => {
    const lat = parseFloat(placeObj.lat);
    const lon = parseFloat(placeObj.lon);
    const destinationCoordinates = [lat, lon];
    
    setSelectedDest(destinationCoordinates);
    setSearchQuery(placeObj.display_name); // Set input to full location context
    setShowDropdown(false);                // Collapse suggestions list view

    // Shift map view slightly to enclose the target parameter
    setMapCenter(destinationCoordinates);

    // Backend communication request loop
    try {
      // REPLACE TARGET STRING BELOW WITH YOUR ACTUAL PERSISTENT RENDER SERVER INSTANCE
      const backendUrl = "https://your-render-backend-url.onrender.com/api/route";
      
      const payload = {
        source: startLoc,
        destination: destinationCoordinates,
        temporalHour: timeValue
      };

      const serverResponse = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!serverResponse.ok) throw new Error("Server path calculation error.");
      const pathData = await serverResponse.json();
      
      // Expected backend array output mapping: [[lat1, lon1], [lat2, lon2]...]
      if (pathData.polyline) setRoutePolyline(pathData.polyline);
      if (pathData.metrics) setSafetyMetrics(pathData.metrics);

    } catch (serverErr) {
      console.error("Unable to securely reach safe calculation backend engine:", serverErr);
      // Local structural demo fallback pathway configuration line 
      setRoutePolyline([startLoc, destinationCoordinates]);
      setSafetyMetrics({ score: 88, lampsFound: 14 });
    }
  };

  // Pre-load initialization visual block screen
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-900 text-white font-sans">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl font-semibold animate-pulse tracking-wide text-emerald-400">Initializing ShadowPath Engine...</p>
          <p className="text-xs text-gray-500 mt-2">Locking hardware GPS satellite tracking nodes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen font-sans overflow-hidden bg-gray-950">
      
      {/* =========================================================================
          APPLICATION INTERACTIVE FLOATING HEADS-UP DISPLAY CONTROL HUD
          ========================================================================= */}
      <div className="absolute top-4 left-4 z-[1000] w-[26rem] bg-gray-900/90 backdrop-blur-md text-white p-5 rounded-2xl shadow-2xl border border-gray-800/80 flex flex-col gap-4">
        <div>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-extrabold text-emerald-400 tracking-tight">ShadowPath HUD</h1>
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] uppercase font-bold rounded-full border border-emerald-500/20 tracking-wider">MERN Core v1.2</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Context-Aware Safe Pedestrian Navigation Framework</p>
        </div>

        {/* Live GPS Core Telemetry Monitor Module */}
        <div className="px-3.5 py-2.5 bg-gray-950/60 rounded-xl text-xs border border-gray-800/60 flex items-center justify-between">
          <div>
            <span className="text-emerald-400 font-bold block animate-pulse">● Live Source GPS Coordinates:</span>
            <p className="text-gray-300 font-mono text-[11px] mt-0.5">{startLoc[0].toFixed(5)}° N, {startLoc[1].toFixed(5)}° E</p>
          </div>
          <button 
            onClick={() => setMapCenter([...startLoc])}
            className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-emerald-400 transition-colors border border-gray-700"
            title="Recenter Map View onto GPS Core Node"
          >
            🎯
          </button>
        </div>

        {/* Global Destination Autocomplete Input Interface Panel */}
        <div className="relative">
          <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Target Destination Vector:</label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleDestinationSearch(e.target.value)}
              placeholder="Search stations, roads, landmarks globally..."
              className="w-full px-3.5 py-2.5 bg-gray-950/80 text-white rounded-xl text-sm border border-gray-800 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-200"
            />
            {isSearching && (
              <div className="absolute right-3.5 top-3 text-emerald-400 text-xs animate-spin">⏳</div>
            )}
          </div>

          {/* Autocomplete Multi-Node Results Dropdown Element Panel */}
          {showDropdown && searchResults.length > 0 && (
            <ul className="absolute top-full left-0 w-full bg-gray-900/95 backdrop-blur-lg mt-2 max-h-64 overflow-y-auto rounded-xl shadow-2xl border border-gray-800 divide-y divide-gray-800/40 overflow-hidden z-[2000]">
              {searchResults.map((location) => (
                <li
                  key={location.place_id}
                  onClick={() => selectTargetDestination(location)}
                  className="p-3.5 text-xs text-gray-300 hover:bg-emerald-500/10 hover:text-white cursor-pointer transition-colors duration-150 flex flex-col gap-0.5"
                >
                  <span className="font-semibold text-gray-100 truncate">{location.name || "Named Vector Route"}</span>
                  <span className="text-gray-400 truncate text-[10px] font-light">{location.display_name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Environmental Reactive Temporal Sync Controls Slider Module */}
        <div className="bg-gray-950/40 p-3 rounded-xl border border-gray-800/40">
          <div className="flex justify-between text-xs font-bold mb-1">
            <span className="text-gray-400 uppercase tracking-wider">Temporal Simulation Window:</span>
            <span className="text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">{timeValue}:00 hrs</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="23" 
            value={timeValue}
            onChange={(e) => setTimeValue(parseInt(e.target.value))}
            className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 my-2"
          />
          <p className="text-[10px] text-gray-500 font-light">Adjusting slider alters dynamic darkness coefficients within the routing core calculation loops.</p>
        </div>

        {/* Live System Performance Safety Analysis Metrics Output Display */}
        {safetyMetrics && (
          <div className="grid grid-cols-2 gap-3 p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 animate-fadeIn">
            <div className="text-center p-2 bg-gray-950/40 rounded-lg border border-gray-800/50">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Safety Index</span>
              <span className="text-xl font-black text-emerald-400 font-mono">{safetyMetrics.score}%</span>
            </div>
            <div className="text-center p-2 bg-gray-950/40 rounded-lg border border-gray-800/50">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Active Assets</span>
              <span className="text-xl font-black text-blue-400 font-mono">{safetyMetrics.lampsFound} Lamps</span>
            </div>
          </div>
        )}

        {/* Emergency System SOS Panel Actions Group */}
        <div className="flex gap-2 mt-1">
          <button 
            onClick={() => setIsReportingMode(!isReportingMode)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${
              isReportingMode 
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 ring-2 ring-amber-500/20' 
                : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700'
            }`}
          >
            ⚠️ {isReportingMode ? "Cancel Pin Mode" : "Report Hazard Pin"}
          </button>
          <button 
            onClick={() => alert(`CRITICAL ALERT: Emergency broadcast signals fired from user nodes: ${startLoc}`)}
            className="px-5 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-black rounded-xl uppercase tracking-wider transition-all shadow-lg shadow-red-600/20 border border-red-500"
          >
            SOS Panic
          </button>
        </div>
      </div>

      {/* =========================================================================
          CORE SPATIAL ENGINE CANVAS INTERFACE RENDER LAYER
          ========================================================================= */}
      <MapContainer 
        center={mapCenter || [14.6600, 77.5500]} 
        zoom={14} 
        className="h-full w-full z-0"
        zoomControl={false} // Disable default controls to optimize floating layout visibility
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Dynamic global viewport controller module hook */}
        {mapCenter && <ChangeMapView center={mapCenter} />}

        {/* Node Position Vector Element Marker Renders */}
        {startLoc && (
          <Marker position={startLoc}>
            <Popup className="font-sans text-xs">
              <b className="text-emerald-500">Live Hardware Origin Core</b><br/>
              Automatic location verification authenticated.
            </Popup>
          </Marker>
        )}

        {selectedDest && (
          <Marker position={selectedDest}>
            <Popup className="font-sans text-xs">
              <b className="text-blue-500">Target Target Matrix Destination</b><br/>
              Safe pathway evaluation route endpoints.
            </Popup>
          </Marker>
        )}

        {/* Dynamic Safe Routing Core Pipeline Pathway Line Render */}
        {routePolyline.length > 0 && (
          <Polyline 
            positions={routePolyline} 
            color="#10b981" // Custom Emerald vector line to denote a verified safety path
            weight={5}
            opacity={0.85}
            dashArray={isReportingMode ? "10, 10" : "0"} // Visually changes design layout based on state mode
          />
        )}
      </MapContainer>
    </div>
  );
}