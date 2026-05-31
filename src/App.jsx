import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import { Navigation, Shield, Eye, AlertTriangle, Sun, Crosshair, Navigation2, Search, MapPin, Plus, Check, Siren, ShieldAlert, Moon, Clock, Volume2, Share2, Users, X, Store, Lightbulb } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icons glitch
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Upgraded custom marker styles matching your legend signs perfectly
const createCustomMarker = (type) => {
  let iconHtml = '';
  
  if (type === 'light') {
    iconHtml = `
      <div class="flex items-center justify-center w-9 h-9 rounded-full bg-amber-500/20 border-2 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.7)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"></path>
          <line x1="9" y1="18" x2="15" y2="18"></line>
          <line x1="10" y1="22" x2="14" y2="22"></line>
        </svg>
      </div>`;
  } else if (type === 'store') {
    iconHtml = `
      <div class="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-500/20 border-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.7)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg></div>`;
  } else if (type === 'hazard') {
    iconHtml = `
      <div class="flex items-center justify-center w-9 h-9 rounded-full bg-rose-500/20 border-2 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.8)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </div>`;
  } else if (type === 'user' || type === 'live') {
    iconHtml = `<div class="relative flex items-center justify-center w-6 h-6 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_15px_#22d3ee]"><div class="absolute w-10 h-10 rounded-full bg-cyan-400/30 animate-ping"></div></div>`;
  } else if (type === 'sos') {
    iconHtml = `<div class="flex items-center justify-center w-9 h-9 rounded-full bg-blue-500/30 border-2 border-blue-400 shadow-[0_0_18px_rgba(59,130,246,0.9)] animate-pulse"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>`;
  }

  return L.divIcon({
    html: iconHtml,
    className: 'custom-leaflet-icon',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
};

function MapViewHandler({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.flyTo(center, zoom || 15.5, { animate: true, duration: 1.5 });
    }
  }, [center, zoom, map]);
  return null;
}

function MapClickHandler({ onMapClick, isReporting }) {
  useMapEvents({
    click(e) {
      if (isReporting) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    },
  });
  return null;
}

export default function App() {
  const [mapCenter, setMapCenter] = useState([14.6740, 77.5930]); 
  const [mapZoom, setMapZoom] = useState(15.5); 
  const [startLoc, setStartLoc] = useState('Maruthi Nagar, Anantapur (Live)');
  const [basePoint, setBasePoint] = useState([14.6690, 77.5910]); 

  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLiveTracking, setIsLiveTracking] = useState(false);
  const [userProgress, setUserProgress] = useState(0);

  const [isReportingMode, setIsReportingMode] = useState(false);
  const [customHazards, setCustomHazards] = useState([]);
  const [showReportNotification, setShowReportNotification] = useState(false);
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [isCompanionViewOpen, setIsCompanionViewOpen] = useState(false);
  const [showLinkCopiedNotification, setShowLinkCopiedNotification] = useState(false);

  const getSystemMinutesFromNoon = () => {
    const now = new Date();
    const hour = now.getHours();
    const min = now.getMinutes();
    return hour >= 12 ? (hour - 12) * 60 + min : (hour + 12) * 60 + min;
  };

  const [minuteSliderValue, setMinuteSliderValue] = useState(getSystemMinutesFromNoon());
  const isNightTime = minuteSliderValue >= 360; 

  const [dynamicMetrics, setDynamicMetrics] = useState({
    distanceStr: '1.4 km',
    durationStr: '18 min',
    lightingPercent: 94,
    darkZonesCount: 3,
    trafficText: 'HIGH',
    trafficRotate: 'rotate-45'
  });

  // Locked down explicit regional coordinates to ensure layout pins render flawlessly relative to your screenshot route path
  const [selectedDestination, setSelectedDestination] = useState({
    name: 'Clock Tower, Anantapur - Krishnagiri Road',
    coords: [14.6792, 77.5954],
    baseLighting: 94,
    baseDarkZones: 3,
    traffic: 'High',
    trafficRotate: 'rotate-45',
    features: [
      { id: 1, type: 'light', pos: [14.6715, 77.5920], radius: 80, desc: '💡 Working LED Streetlight: Fully Illuminated Safe Segment' },
      { id: 2, type: 'store', pos: [14.6740, 77.5931], radius: 110, desc: '🛍️ Active Business Area: High Commercial Foot Traffic / Shops Open' },
      { id: 3, type: 'light', pos: [14.6765, 77.5942], radius: 80, desc: '💡 Working LED Streetlight: Active Safety Grid Corridor' },
      { id: 4, type: 'hazard', pos: [14.6738, 77.5955], radius: 95, desc: '⚠️ Danger Risk Zone: Non-Working Infrastructure Lights reported' }
    ]
  });

  const safeHavensDatabase = [
    { id: 'sos-1', pos: [14.6752, 77.5912], type: 'sos', desc: '🚨 EMERGENCY SAFEHAVEN: Anantapur Urban Police Station Hub' },
    { id: 'sos-2', pos: [14.6715, 77.5958], type: 'sos', desc: '🚨 EMERGENCY SAFEHAVEN: Government General Hospital Trauma Wing' }
  ];

  const searchDatabase = [
    { 
      name: 'Clock Tower, Anantapur - Krishnagiri Road', 
      coords: [14.6792, 77.5954],
      baseLighting: 94,
      baseDarkZones: 3,
      traffic: 'High',
      trafficRotate: 'rotate-45',
      features: [
        { id: 1, type: 'light', pos: [14.6715, 77.5920], radius: 80, desc: '💡 Working LED Streetlight: Fully Illuminated Safe Segment' },
        { id: 2, type: 'store', pos: [14.6740, 77.5931], radius: 110, desc: '🛍️ Active Business Area: High Commercial Foot Traffic / Shops Open' },
        { id: 3, type: 'light', pos: [14.6765, 77.5942], radius: 80, desc: '💡 Working LED Streetlight: Active Safety Grid Corridor' },
        { id: 4, type: 'hazard', pos: [14.6738, 77.5955], radius: 95, desc: '⚠️ Danger Risk Zone: Non-Working Infrastructure Lights reported' }
      ]
    },
    { 
      name: 'Maruthi Nagar Central Park, Anantapur', 
      coords: [14.6710, 77.5915],
      baseLighting: 98,
      baseDarkZones: 0,
      traffic: 'Medium',
      trafficRotate: 'rotate-90',
      features: [
        { id: 1, type: 'light', pos: [14.6700, 77.5912], radius: 70, desc: '💡 Working Streetlight: Clear View Pathway' },
        { id: 2, type: 'store', pos: [14.6708, 77.5914], radius: 85, desc: '🛍️ Active Working Marketplace Area' }
      ]
    }
  ];

  const calculateDynamicSafetyMetrics = (startCoords, endCoords, targetDest) => {
    if (!startCoords || !endCoords) return;
    const R = 6371; 
    const dLat = (endCoords[0] - startCoords[0]) * Math.PI / 180;
    const dLon = (endCoords[1] - startCoords[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(startCoords[0] * Math.PI / 180) * Math.cos(endCoords[0] * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const realDistance = R * c; 

    const currentLighting = isNightTime ? targetDest.baseLighting : 100;
    const currentDarkZones = isNightTime ? (targetDest.baseDarkZones + customHazards.length) : 0;
    const walkingDurationMins = Math.round(realDistance * 13); 

    setDynamicMetrics({
      distanceStr: `${realDistance.toFixed(1)} km`,
      durationStr: `${walkingDurationMins} min`,
      lightingPercent: currentLighting,
      darkZonesCount: currentDarkZones,
      trafficText: isNightTime ? targetDest.traffic.toUpperCase() : 'MEDIUM',
      trafficRotate: isNightTime ? targetDest.trafficRotate : 'rotate-90'
    });
  };

  const detectLiveLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const userGPS = [latitude, longitude];
          setBasePoint(userGPS);
          setMapCenter(userGPS);
          setStartLoc(`📍 Current Location Locked (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
          calculateDynamicSafetyMetrics(userGPS, selectedDestination.coords, selectedDestination);
        },
        () => {
          calculateDynamicSafetyMetrics(basePoint, selectedDestination.coords, selectedDestination);
        }
      );
    }
  };

  useEffect(() => {
    detectLiveLocation();
  }, [minuteSliderValue, customHazards]);

  const filteredSuggestions = searchDatabase.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const targetPoint = selectedDestination.coords;

  const safestPathCoordinates = [
    basePoint,
    [14.6715, 77.5920],
    [14.6740, 77.5931],
    [14.6765, 77.5942],
    targetPoint,
  ];

  const shortestUnlitCoordinates = [
    basePoint,
    [14.6738, 77.5955],
    targetPoint,
  ];

  const activeMapMarkers = isSOSActive 
    ? safeHavensDatabase 
    : [...(selectedDestination?.features || []), ...customHazards];

  const handleMapClickToReport = (coords) => {
    const newHazard = {
      id: `crowd-${Date.now()}`,
      pos: coords,
      type: 'hazard',
      radius: 95,
      desc: '⚠️ Crowdsourced Report: Pedestrian Non-Working Dark Road Area'
    };
    setCustomHazards([...customHazards, newHazard]);
    setIsReportingMode(false); 
    setShowReportNotification(true);
    setTimeout(() => setShowReportNotification(false), 3000);
  };

  const getCurrentUserPosition = () => {
    const activeRoute = isSOSActive ? [basePoint, [14.6752, 77.5912]] : safestPathCoordinates;
    const index = Math.min(Math.floor((userProgress / 100) * activeRoute.length), activeRoute.length - 1);
    return activeRoute[index] || activeRoute[0];
  };

  useEffect(() => {
    let interval = null;
    if (isLiveTracking) {
      interval = setInterval(() => {
        setUserProgress((prev) => {
          const next = prev + 2;
          if (next >= 100) return 0;
          return next;
        });
      }, 200);
    } else {
      setUserProgress(0);
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isLiveTracking]);

  const formatHourString = (val) => {
    let totalHours = Math.floor(val / 60) + 12;
    let mins = val % 60;
    let paddedMins = mins < 10 ? `0${mins}` : mins;
    if (totalHours === 12) return `12:${paddedMins} PM`;
    if (totalHours < 24) return `${totalHours - 12}:${paddedMins} PM`;
    return `${totalHours - 24}:${paddedMins} AM`;
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0e17] text-slate-200 select-none flex">
      
      {/* MAP ENGINE CANVAS BACKDROP */}
      <div className="absolute inset-0 w-full h-full z-0">
        <MapContainer center={mapCenter} zoom={mapZoom} zoomControl={false} className="w-full h-full">
          <TileLayer 
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" 
            attribution='&copy; OpenStreetMap &copy; CARTO' 
            opacity={isNightTime ? 0.85 : 1.0}
          />
          <MapViewHandler center={isSOSActive ? [14.6735, 77.5925] : mapCenter} zoom={isSOSActive ? 16 : mapZoom} />
          <MapClickHandler onMapClick={handleMapClickToReport} isReporting={isReportingMode} />

          {/* 💡 Ambient Radiation Glow Halos */}
          {!isSOSActive && selectedDestination.features.map((feat) => {
            let colorOption = '#f59e0b'; 
            if (feat.type === 'store') colorOption = '#10b981'; 
            if (feat.type === 'hazard') colorOption = '#ef4444'; 

            return (
              <Circle 
                key={`glow-${feat.id}`}
                center={feat.pos}
                radius={feat.radius || 90}
                pathOptions={{
                  color: colorOption,
                  fillColor: colorOption,
                  fillOpacity: 0.08,
                  weight: 1,
                  dashArray: feat.type === 'hazard' ? '5, 5' : '0'
                }}
              />
            );
          })}

          {/* Render User report flags */}
          {customHazards.map((hazard) => (
            <Circle 
              key={`custom-glow-${hazard.id}`}
              center={hazard.pos}
              radius={90}
              pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.1, weight: 1, dashArray: '4, 4' }}
            />
          ))}

          {!isSOSActive && (
            <>
              {/* Working/Non-Working Road Polylines */}
              <Polyline positions={safestPathCoordinates} pathOptions={{ color: isNightTime ? '#14b8a6' : '#a855f7', weight: 6, opacity: 0.95, lineCap: 'round' }} />
              <Polyline positions={shortestUnlitCoordinates} pathOptions={{ color: '#475569', weight: 3, opacity: 0.5, dashArray: '8, 12' }} />
              <Marker position={targetPoint} icon={createCustomMarker('user')} />
            </>
          )}

          {isSOSActive && <Polyline positions={[basePoint, [14.6752, 77.5912]]} pathOptions={{ color: '#3b82f6', weight: 5, opacity: 0.95, lineCap: 'round' }} />}
          <Marker position={basePoint} icon={createCustomMarker('live')} />
          
          {/* 🌟 FIX: Stripped the night guard filter loop entirely to make icons stay visible at 1:35 PM */}
          {activeMapMarkers.map((feat) => (
            <Marker key={feat.id} position={feat.pos} icon={createCustomMarker(feat.type)}>
              <Popup className="dark-popup"><span className="font-semibold text-slate-900 text-xs block">{feat.desc}</span></Popup>
            </Marker>
          ))}

          {isLiveTracking && <Marker position={getCurrentUserPosition()} icon={createCustomMarker('live')} />}
        </MapContainer>
      </div>

      {/* NOTIFICATIONS CONTAINER */}
      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-[5000] flex flex-col gap-2">
        {showReportNotification && (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-950/90 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-semibold backdrop-blur-md">
            <Check size={14} className="bg-emerald-500 text-slate-950 rounded-full p-0.5" />
            <span>Database Updated Live!</span>
          </div>
        )}
        {showLinkCopiedNotification && (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-blue-950/90 border border-blue-500/30 rounded-xl text-xs text-blue-300 font-semibold backdrop-blur-md">
            <Share2 size={14} className="text-blue-400" />
            <span>Link copied to clipboard!</span>
          </div>
        )}
      </div>

      {/* HUD SIDEBAR HUD CARD */}
      <div className="absolute top-6 left-6 z-[1000] w-[390px] flex flex-col gap-4 max-h-[calc(100vh-48px)] overflow-y-auto pr-1">
        
        {/* Brand Header */}
        <div className="flex items-center gap-3.5 p-4 border rounded-2xl backdrop-blur-xl shadow-2xl bg-slate-950/75 border-white/10">
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-400"><Shield size={22} /></div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white leading-tight">ShadowPath</h1>
            <p className="text-xs font-medium text-slate-400/90 mt-0.5">Safe pedestrian routing engine</p>
          </div>
        </div>

        {/* Guardian Share */}
        <div className="flex flex-col p-4 border border-white/10 rounded-2xl bg-slate-950/75 backdrop-blur-xl shadow-2xl gap-2.5">
          <button 
            onClick={() => { setShowLinkCopiedNotification(true); setIsCompanionViewOpen(true); setTimeout(() => setShowLinkCopiedNotification(false), 2500); }}
            className="w-full py-2.5 font-bold text-xs rounded-xl flex items-center justify-center gap-2 border bg-blue-950/40 border-blue-500/20 text-blue-300 hover:bg-blue-950/70 transition-all cursor-pointer"
          >
            <Share2 size={13} /><span>🔗 Generate Companion Share Link</span>
          </button>
        </div>

        {/* Time Slider */}
        <div className="flex flex-col p-4 border border-white/10 rounded-2xl bg-slate-950/75 backdrop-blur-xl shadow-2xl gap-3">
          <div className="flex justify-between items-center text-xs font-bold text-white px-0.5">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider flex items-center gap-1"><Clock size={11} /> Temporal Sync</span>
            <span className={isNightTime ? 'text-amber-400' : 'text-cyan-400'}>{formatHourString(minuteSliderValue)}</span>
          </div>
          <input type="range" min="0" max="960" value={minuteSliderValue} onChange={(e) => { setMinuteSliderValue(parseInt(e.target.value)); setIsLiveTracking(false); setUserProgress(0); }} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400" />
        </div>

        {/* SOS Panel */}
        <div className="flex flex-col p-4 border border-white/10 rounded-2xl bg-slate-950/75 backdrop-blur-xl shadow-2xl gap-3">
          <button onClick={() => { setIsSOSActive(!isSOSActive); setIsLiveTracking(false); setUserProgress(0); }} className={`w-full py-3.5 font-black text-xs tracking-wider uppercase rounded-xl flex items-center justify-center gap-2 border transition-all cursor-pointer ${isSOSActive ? 'bg-rose-600 border-rose-400' : 'bg-gradient-to-r from-red-600 to-amber-600 text-white border-red-500/30'}`}>
            <Siren size={15} /><span>{isSOSActive ? '❌ CANCEL PANIC ROUTING' : '🚨 ACTIVATE SOS PANIC REFUGE'}</span>
          </button>
        </div>

        {!isSOSActive && (
          <>
            <div className="flex flex-col p-4 border border-white/10 rounded-2xl bg-slate-950/75 backdrop-blur-xl shadow-2xl gap-2.5">
              <button onClick={() => setIsReportingMode(!isReportingMode)} className={`w-full py-3 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 border transition-all cursor-pointer ${isReportingMode ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse' : 'bg-slate-900/50 text-slate-200 border-white/5 hover:bg-slate-900/80'}`}><Plus size={14} /><span>{isReportingMode ? '🎯 Click Map to Drop Report' : '⚠️ Log New Broken Light'}</span></button>
            </div>

            <div className="relative flex flex-col gap-4 p-5 border border-white/10 rounded-2xl bg-slate-950/75 backdrop-blur-xl shadow-2xl">
              <div className="flex flex-col gap-1.5"><label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Start Point</label><div className="relative flex items-center"><Navigation className="absolute left-3.5 text-cyan-400 transform rotate-45" size={15} /><input type="text" readOnly value={startLoc} className="w-full pl-10 pr-10 py-2.5 bg-slate-900/40 border border-white/5 rounded-xl text-xs text-slate-300 font-semibold focus:outline-none truncate" /><button onClick={detectLiveLocation} className="absolute right-3.5 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"><Crosshair size={14} /></button></div></div>
              <div className="relative flex flex-col gap-1.5"><label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Destination</label><div className="relative flex items-center"><Search className="absolute left-3.5 text-fuchsia-400" size={15} /><input type="text" placeholder="Search destination addresses..." value={searchQuery} onFocus={() => setShowDropdown(true)} onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }} className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-white/10 rounded-xl text-xs text-slate-100 focus:outline-none placeholder-slate-500 font-medium" /></div>
                {showDropdown && searchQuery && (
                  <div className="absolute top-[64px] left-0 w-full bg-slate-950 border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-[140px] overflow-y-auto z-[2000]">
                    {filteredSuggestions.length > 0 ? filteredSuggestions.map((item, idx) => (<div key={idx} onClick={() => { setSelectedDestination(item); setSearchQuery(item.name); setMapCenter([(basePoint[0] + item.coords[0]) / 2, (basePoint[1] + item.coords[1]) / 2]); calculateDynamicSafetyMetrics(basePoint, item.coords, item); setShowDropdown(false); }} className="flex items-center gap-2.5 px-4 py-3 hover:bg-white/5 border-b border-white/[0.03] transition-colors cursor-pointer text-left"><MapPin size={13} className="text-fuchsia-400" /><span className="text-xs text-slate-300 font-medium truncate">{item.name}</span></div>)) : <div className="px-4 py-4 text-xs text-slate-500 italic text-center">No locations found</div>}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* HUD Infrastructure Legend Card */}
        <div className="flex flex-col p-4 border border-white/10 rounded-2xl bg-slate-950/75 backdrop-blur-xl shadow-2xl gap-2">
          <span className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">Infrastructure Map Signs</span>
          <div className="grid grid-cols-1 gap-2 mt-1 text-xs font-semibold text-slate-300">
            <div className="flex items-center gap-2.5"><div className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500 text-amber-400"><Lightbulb size={11} fill="currentColor" /></div><span className="text-slate-400">Amber Bulb: **Working Streetlight Grid**</span></div>
            <div className="flex items-center gap-2.5"><div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400"><Store size={11} /></div><span className="text-slate-400">Green Shop: **Active Working Business Area**</span></div>
            <div className="flex items-center gap-2.5"><div className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/20 border border-rose-500 text-rose-400"><AlertTriangle size={11} /></div><span className="text-slate-400">Red Triangle: **Non-Working / Broken Roads**</span></div>
          </div>
        </div>

        {/* Safety Analytics Summary */}
        <div className="flex flex-col p-5 border border-white/10 rounded-2xl bg-slate-950/75 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between mb-4"><span className="text-[10px] font-extrabold tracking-widest text-slate-300 uppercase">Safety Analytics</span><span className="text-xs font-semibold text-slate-400">{dynamicMetrics.distanceStr} · {dynamicMetrics.durationStr}</span></div>
          <div className="flex justify-around items-center py-1">
            <div className="flex flex-col items-center gap-2.5"><div className="relative flex items-center justify-center w-20 h-20 rounded-full border-[5px] border-cyan-500/10"><div className="absolute inset-0 rounded-full border-[5px] border-cyan-400 border-t-transparent border-r-transparent" style={{ transform: `rotate(${dynamicMetrics.lightingPercent * 3.6 - 45}deg)` }}></div><span className="text-lg font-black text-white">{dynamicMetrics.lightingPercent}%</span></div><span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><Sun size={11} className="text-cyan-400" /> Lighting</span></div>
            <div className="flex flex-col items-center gap-2.5"><div className="relative flex items-center justify-center w-20 h-20 rounded-full border-[5px] border-fuchsia-500/10"><div className={`absolute inset-0 rounded-full border-[5px] border-fuchsia-400 border-b-transparent ${dynamicMetrics.trafficRotate}`}></div><span className="text-xs font-black text-white uppercase tracking-tight">{dynamicMetrics.trafficText}</span></div><span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><Eye size={11} className="text-fuchsia-400" /> Density</span></div>
          </div>
          <div className="w-full h-px bg-white/5 my-4.5"></div>
          <div className="flex flex-col gap-3"><div className="flex items-center justify-between p-3 bg-slate-900/30 border border-white/5 rounded-xl"><span className="text-xs font-medium text-slate-300/90 flex items-center gap-2"><AlertTriangle size={14} className="text-amber-500" /> Avoided Dark Zones</span><span className="font-extrabold text-xs text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-md border border-amber-500/20">{dynamicMetrics.darkZonesCount}</span></div></div>
        </div>

        {/* Live Tracking Mode Toggle Button */}
        <div className="flex items-center justify-between p-4 border border-white/10 rounded-2xl bg-slate-950/75 backdrop-blur-xl shadow-2xl">
          <span className="text-[10px] font-extrabold tracking-widest uppercase flex items-center gap-2 text-slate-300"><span className={`w-2 h-2 rounded-full ${isLiveTracking ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></span>Live Tracking Assist Mode</span>
          <button onClick={() => setIsLiveTracking(!isLiveTracking)} className="relative inline-flex h-6 w-11 items-center rounded-full cursor-pointer bg-slate-800"><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-out ${isLiveTracking ? 'translate-x-6 bg-cyan-400 flex items-center justify-center text-[8px]' : 'translate-x-1'}`}>{isLiveTracking && <Volume2 size={10} className="text-slate-950" />}</span></button>
        </div>
      </div>

      {/* Companion View Overlay Window */}
      {isCompanionViewOpen && (
        <div className="absolute top-6 right-6 z-[4000] w-[350px] bg-slate-950/85 border border-blue-500/30 rounded-3xl backdrop-blur-2xl shadow-2xl flex flex-col p-5 gap-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div><span className="text-xs font-bold text-slate-200">Guardian Tracking Link Active</span></div>
            <button onClick={() => setIsCompanionViewOpen(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer"><X size={15} /></button>
          </div>
          <div className="flex items-center gap-3 bg-slate-900/50 border border-white/5 p-3 rounded-xl">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-cyan-400/10 text-cyan-400 border border-cyan-400/20"><Users size={15} /></div>
            <div className="flex flex-col truncate"><span className="text-xs font-extrabold text-white">Target Device: Pedestrian Core</span><span className="text-[10px] text-slate-400 truncate">Status: {isLiveTracking ? `Moving (${userProgress}% completion)` : 'Stationary'}</span></div>
          </div>
          <div className="flex flex-col gap-2 border border-white/5 bg-slate-900/20 p-3.5 rounded-xl text-[11px] font-medium text-slate-400">
            <div className="flex justify-between"><span>Route Safety Index:</span><span className="text-emerald-400 font-bold">Optimal ({dynamicMetrics.lightingPercent}%)</span></div>
            <div className="flex justify-between mt-1"><span>Current Distance Frame:</span><span className="text-cyan-400">{dynamicMetrics.distanceStr}</span></div>
            <div className="flex justify-between mt-1"><span>Threat/SOS Status:</span><span className={isSOSActive ? 'text-red-400 font-black animate-pulse' : 'text-slate-500'}>{isSOSActive ? '🚨 ALERT ACTIVE' : 'Nominal (Secure)'}</span></div>
          </div>
          {isLiveTracking && <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-white/5"><div className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full transition-all duration-300" style={{ width: `${userProgress}%` }}></div></div>}
        </div>
      )}

    </div>
  );
}