import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

export default function App() {
  const [startLoc, setStartLoc] = useState([14.6599, 77.5895]);
  const [mapCenter, setMapCenter] = useState([14.6599, 77.5895]);
  const [searchQuery, setSearchQuery] = useState('railway');

  return (
    <div className="relative h-screen w-screen bg-[#0a0a0a] overflow-hidden font-sans">
      
      {/* LEFT SIDEBAR HUD CONTAINER */}
      <div className="absolute top-0 left-0 z-[1000] h-full w-[420px] p-6 flex flex-col gap-4 overflow-y-auto bg-gradient-to-r from-black/80 to-transparent pointer-events-none">
        
        <div className="pointer-events-auto flex flex-col gap-3">
          
          {/* Share Link Card */}
          <div className="bg-[#0d1117]/90 border border-gray-800 p-3 rounded-xl flex items-center justify-center gap-2 text-blue-400 text-xs font-semibold cursor-pointer">
            <span className="text-sm">🔗</span> Generate Companion Share Link
          </div>

          {/* Temporal Sync Card */}
          <div className="bg-[#0d1117]/90 border border-gray-800 p-5 rounded-2xl shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <p className="text-[10px] text-gray-400 font-bold tracking-widest flex items-center gap-2">
                🕒 TEMPORAL SYNC
              </p>
              <span className="text-xs font-bold text-amber-400">11:50 AM</span>
            </div>
            <input type="range" className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none accent-cyan-500 cursor-pointer" />
          </div>

          {/* SOS Panic Button */}
          <button className="w-full bg-gradient-to-r from-red-600 to-orange-600 p-4 rounded-2xl font-black text-xs tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-red-900/20 uppercase">
            🚨 🆘 ACTIVATE SOS PANIC REFUGE
          </button>

          {/* Log Light Card */}
          <div className="bg-[#0d1117]/90 border border-gray-800 p-4 rounded-2xl text-center text-xs font-bold text-gray-300 cursor-pointer hover:bg-gray-800 transition-all flex items-center justify-center gap-2">
            <span>+</span> ⚠️ Log New Broken Light
          </div>

          {/* Navigation Card */}
          <div className="bg-[#0d1117]/90 border border-gray-800 p-5 rounded-2xl shadow-xl">
            <p className="text-[10px] text-gray-400 font-bold tracking-widest mb-4">START POINT</p>
            <div className="bg-black/40 border border-gray-800 p-3 rounded-xl flex items-center gap-3 text-xs text-blue-300 font-mono mb-6">
              <span>🚀</span> 📍 Current Location Locked (14.6599, 77.5...
            </div>

            <p className="text-[10px] text-gray-400 font-bold tracking-widest mb-2">DESTINATION</p>
            <div className="relative">
              <input 
                type="text" 
                value={searchQuery}
                className="w-full bg-black/40 border border-gray-800 rounded-xl px-10 py-3 text-sm focus:border-blue-500 outline-none"
              />
              <span className="absolute left-3 top-3 text-gray-500">🔍</span>
            </div>
            <p className="text-center text-[10px] text-gray-600 mt-4 italic">No locations found</p>
          </div>

          {/* Map Signs Legend */}
          <div className="bg-[#0d1117]/90 border border-gray-800 p-5 rounded-2xl shadow-xl">
            <p className="text-[10px] text-gray-400 font-bold tracking-widest mb-4">INFRASTRUCTURE MAP SIGNS</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs">
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-amber-500/20 text-amber-500">💡</span>
                <p>Amber Bulb: <span className="text-gray-400">**Working Streetlight Grid**</span></p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-green-500/20 text-green-500">🏪</span>
                <p>Green Shop: <span className="text-gray-400">**Active Working Business Area**</span></p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-red-500/20 text-red-500">⚠️</span>
                <p>Red Triangle: <span className="text-gray-400">**Non-Working / Broken Roads**</span></p>
              </div>
            </div>
          </div>

          {/* Safety Analytics Card */}
          <div className="bg-[#0d1117]/90 border border-gray-800 p-5 rounded-2xl shadow-xl flex justify-between items-center">
            <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Safety Analytics</p>
            <p className="text-xs font-bold text-gray-300">2.2 km · 29 min</p>
          </div>

        </div>
      </div>

      <MapContainer center={mapCenter} zoom={16} className="h-full w-full" zoomControl={false}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
      </MapContainer>
    </div>
  );
}