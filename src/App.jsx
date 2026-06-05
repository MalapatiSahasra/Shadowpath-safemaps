import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fixes Leaflet missing marker icon visual rendering assets
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom engine controller component to re-center the map viewport smoothly
function ChangeView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, 15);
  }, [center, map]);
  return null;
}

export default function App() {
  const [startLoc, setStartLoc] = useState([14.6599, 77.5895]); // Standard initial fallback map markers
  const [mapCenter, setMapCenter] = useState([14.6599, 77.5895]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // 1. AUTO-TRIGGER LIVE HARDWARE ACCURATE LOCATION SYSTEM PERMISSION DIALOG ON BOOT
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = [position.coords.latitude, position.coords.longitude];
          setStartLoc(coords);
          setMapCenter(coords);
        },
        (err) => console.log("Using standard fallback coordinates layout:", err),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // 2. DYNAMIC GEOLOCATION QUERY AUTOCOMPLETE ENGINE (NOMINATIM API INTEGRATION)
  const handleSearchChange = async (inputTextValue) => {
    setSearchQuery(inputTextValue);
    if (inputTextValue.trim().length < 3) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      // Pulls localized global data listings relative to context parameters
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(inputTextValue)}&limit=6&addressdetails=1`
      );
      if (response.ok) {
        const matchingPlacesArray = await response.json();
        setSearchResults(matchingPlacesArray);
        setShowDropdown(true);
      }
    } catch (err) {
      console.error("Geocoding lookup operation dropped:", err);
    } finally {
      setIsSearching(false);
    }
  };

  // 3. DROPDOWN SELECTION AND FOCUS HANDLER ROUTINE
  const selectTargetLocation = (placeItemObj) => {
    const customTargetCoordinates = [parseFloat(placeItemObj.lat), parseFloat(placeItemObj.lon)];
    setMapCenter(customTargetCoordinates);
    setSearchQuery(placeItemObj.display_name);
    setShowDropdown(false);
  };

  return (
    <div className="relative h-screen w-screen bg-[#0a0a0a] overflow-hidden font-sans">
      
      {/* PERFECT CLEAN DARK THEME GEOSPATIAL MAP WRAPPER (UNDERLAY LAYER) */}
      <MapContainer center={mapCenter} zoom={15} className="h-full w-full z-0" zoomControl={false}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <ChangeView center={mapCenter} />
        
        {/* Dynamic Markers showing where you are vs destination */}
        <Marker position={startLoc} />
        {mapCenter !== startLoc && <Marker position={mapCenter} />}
      </MapContainer>

      {/* FLOATING SIDEBAR HUD CONTAINER CONTROL PANELS */}
      <div className="absolute top-0 left-0 z-[1000] h-full w-[420px] p-6 flex flex-col gap-4 overflow-y-auto bg-gradient-to-r from-black/95 via-black/50 to-transparent">
        
        {/* COMPANION SHARE LINK CARD */}
        <div className="bg-[#0d1117]/90 border border-gray-800/80 p-3 rounded-xl flex items-center justify-center gap-2 text-blue-400 text-xs font-semibold shadow-2xl backdrop-blur-sm">
          <span className="text-sm">🔗</span> Generate Companion Share Link
        </div>

        {/* TEMPORAL SYNC RANGE SLIDER CARD */}
        <div className="bg-[#0d1117]/95 border border-gray-800/80 p-5 rounded-2xl shadow-2xl backdrop-blur-sm">
          <div className="flex justify-between items-center mb-4">
            <p className="text-[10px] text-gray-400 font-bold tracking-widest flex items-center gap-2">
              🕒 TEMPORAL SYNC
            </p>
            <span className="text-xs font-bold text-amber-400">11:50 AM</span>
          </div>
          <input type="range" className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none accent-cyan-500 cursor-pointer" />
        </div>

        {/* SOS CRITICAL EMERGENCY ACTION BUTTON */}
        <button className="w-full bg-gradient-to-r from-red-600 to-orange-600 p-4 rounded-2xl font-black text-xs tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-red-900/40 uppercase text-white">
          🚨 🆘 ACTIVATE SOS PANIC REFUGE
        </button>

        {/* HAZARD DISCOVERY REPORT CARD ROW */}
        <div className="bg-[#0d1117]/95 border border-gray-800/80 p-4 rounded-2xl text-center text-xs font-bold text-gray-300 shadow-2xl backdrop-blur-sm cursor-pointer">
          <span>+</span> ⚠️ Log New Broken Light
        </div>

        {/* ROUTING CONTROLS NAVIGATION SYSTEM CARD PANEL */}
        <div className="bg-[#0d1117]/95 border border-gray-800/80 p-5 rounded-2xl shadow-2xl backdrop-blur-sm">
          <p className="text-[10px] text-gray-400 font-bold tracking-widest mb-3">START POINT</p>
          <div className="bg-black/50 border border-gray-800/60 p-3 rounded-xl flex items-center gap-3 text-xs text-blue-300 font-mono mb-5">
            <span>🚀</span> 📍 Locked Coordinates: {startLoc[0].toFixed(4)}, {startLoc[1].toFixed(4)}
          </div>

          <p className="text-[10px] text-gray-400 font-bold tracking-widest mb-2">DESTINATION</p>
          <div className="relative">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Type destination address..."
              className="w-full bg-black/50 border border-gray-800 focus:border-blue-500 rounded-xl px-10 py-3 text-sm text-white outline-none transition-colors"
            />
            <span className="absolute left-3 top-3.5 text-gray-500 text-xs">🔍</span>
            
            {/* GOOGLE MAPS STYLE INTERACTIVE AUTO-COMPLETE DISCOVERY POPUP */}
            {showDropdown && searchResults.length > 0 && (
              <ul className="absolute left-0 top-full w-full bg-[#161b22] border border-gray-700 rounded-xl mt-2 max-h-56 overflow-y-auto shadow-2xl divide-y divide-gray-800 z-[5000]">
                {searchResults.map((locationItem) => (
                  <li 
                    key={locationItem.place_id}
                    onClick={() => selectTargetLocation(locationItem)}
                    className="p-3 text-[11px] text-gray-300 hover:bg-gray-800 cursor-pointer transition-colors text-left truncate"
                    title={locationItem.display_name}
                  >
                    {locationItem.display_name}
                  </li>
                ))}
              </ul>
            )}

            {showDropdown && searchResults.length === 0 && !isSearching && (
              <p className="text-center text-[10px] text-gray-500 mt-3 italic">No matching places found</p>
            )}
          </div>
        </div>

        {/* MAP SIGNS LEGEND DECK */}
        <div className="bg-[#0d1117]/95 border border-gray-800/80 p-5 rounded-2xl shadow-2xl backdrop-blur-sm">
          <p className="text-[10px] text-gray-400 font-bold tracking-widest mb-4">INFRASTRUCTURE MAP SIGNS</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-xs">
              <span className="w-6 h-6 flex items-center justify-center rounded-full bg-amber-500/20 text-amber-500 font-bold">💡</span>
              <p>Amber Bulb: <span className="text-gray-400 font-medium">Working Streetlight Grid</span></p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="w-6 h-6 flex items-center justify-center rounded-full bg-green-500/20 text-green-500 font-bold">🏪</span>
              <p>Green Shop: <span className="text-gray-400 font-medium">Active Working Business Area</span></p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="w-6 h-6 flex items-center justify-center rounded-full bg-red-500/20 text-red-500 font-bold">⚠️</span>
              <p>Red Triangle: <span className="text-gray-400 font-medium">Non-Working / Broken Roads</span></p>
            </div>
          </div>
        </div>

        {/* METRICS RESULTS ANALYTICS TRACKER CARD */}
        <div className="bg-[#0d1117]/95 border border-gray-800/80 p-5 rounded-2xl shadow-2xl backdrop-blur-sm flex justify-between items-center">
          <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Safety Analytics</p>
          <p className="text-xs font-bold text-gray-300">2.2 km · 29 min</p>
        </div>

      </div>
    </div>
  );
}