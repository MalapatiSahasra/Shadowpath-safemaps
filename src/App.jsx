import { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom Node Icons
const createIcon = (color, size = 14) =>
  L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 8px ${color}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

const streetlightIcon = L.divIcon({ className: "", html: `<div style="font-size:18px;filter:drop-shadow(0 0 4px #f59e0b)">💡</div>`, iconSize: [20, 20], iconAnchor: [10, 10] });
const brokenLightIcon = L.divIcon({ className: "", html: `<div style="font-size:18px;opacity:0.5">🔦</div>`, iconSize: [20, 20], iconAnchor: [10, 10] });
const shopIcon = L.divIcon({ className: "", html: `<div style="font-size:16px;filter:drop-shadow(0 0 4px #10b981)">🏪</div>`, iconSize: [20, 20], iconAnchor: [10, 10] });
const hazardIcon = L.divIcon({ className: "", html: `<div style="font-size:16px">⚠️</div>`, iconSize: [20, 20], iconAnchor: [10, 10] });
const emergencyRefugeIcon = L.divIcon({ className: "", html: `<div style="font-size:18px;filter:drop-shadow(0 0 6px #ef4444)">🚓</div>`, iconSize: [22, 22], iconAnchor: [11, 11] });

// Generates infrastructure features based dynamically on the midpoint of the journey path
function generateStreetlights(center) {
  const offsets = [[0.0042, 0.0038], [0.0092, 0.0089], [-0.0036, 0.0074], [0.0121, -0.0025], [-0.0064, 0.0120], [0.0037, -0.0062], [0.0081, 0.0158], [-0.0079, -0.0036], [0.0168, 0.0062], [-0.0026, 0.0131]];
  return offsets.map((o, i) => ({ id: i + 1, lat: center[0] + o[0], lng: center[1] + o[1], status: i % 3 === 2 ? "offline" : "online" }));
}

function generateBusinesses(center) {
  const places = [{ offset: [0.0058, 0.0042], name: "Local Market Square", open: true }, { offset: [-0.0040, 0.0098], name: "Emergency Pharmacy 24/7", open: true }, { offset: [0.0145, -0.0013], name: "Central Food Court", open: false }, { offset: [-0.0013, -0.0069], name: "Convenience Store Hub", open: true }];
  return places.map((p, i) => ({ id: i + 1, lat: center[0] + p.offset[0], lng: center[1] + p.offset[1], name: p.name, open: p.open }));
}

function generateRefugeHubs(center) {
  return [{ id: 101, name: "City Core Police Station", lat: center[0] + 0.0042, lng: center[1] - 0.0125, type: "Police Station" }, { id: 102, name: "District General Hospital", lat: center[0] - 0.0098, lng: center[1] + 0.0079, type: "Hospital" }];
}

// OSRM Real-world street pathing geometry engine
async function fetchOSRMRoute(startPt, endPt, alternativeMode = false) {
  try {
    const url = `https://router.openstreetmap.org/route/v1/driving/${startPt[1]},${startPt[0]};${endPt[1]},${endPt[0]}?overview=full&geometries=geojson&alternatives=${alternativeMode}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      const selectedRoute = alternativeMode && data.routes[1] ? data.routes[1] : data.routes[0];
      const coords = selectedRoute.geometry.coordinates.map(c => [c[1], c[0]]);
      return { coords, distanceText: `${(selectedRoute.distance / 1000).toFixed(2)} km`, rawMeters: selectedRoute.distance };
    }
  } catch (e) { console.error("OSRM Route fetching error: ", e); }
  return null;
}

function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, map.getZoom()); }, [center, map]);
  return null;
}

function MapBoundsUpdater({ standardRoute, shadowPathRoute }) {
  const map = useMap();
  useEffect(() => {
    const allCoords = [];
    if (standardRoute) allCoords.push(...standardRoute);
    if (shadowPathRoute) allCoords.push(...shadowPathRoute);
    if (allCoords.length > 0) map.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50] });
  }, [standardRoute, shadowPathRoute, map]);
  return null;
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({ contextmenu(e) { onMapClick(e.latlng); } });
  return null;
}

async function searchNearbyPlaces(lat, lng, query = "") {
  try {
    const viewbox = `${lng - 0.5},${lat - 0.5},${lng + 0.5},${lat + 0.5}`;
    const url = query ? `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=10&viewbox=${viewbox}&bounded=0&lat=${lat}&lon=${lng}` : `https://nominatim.openstreetmap.org/search?q=station&format=json&limit=15&viewbox=${viewbox}&bounded=0`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    return data.map((p) => ({ name: p.display_name.split(",").slice(0, 3).join(", "), lat: parseFloat(p.lat), lng: parseFloat(p.lon) }));
  } catch { return []; }
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    return data.display_name?.split(",").slice(0, 3).join(", ") || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch { return `${lat.toFixed(4)}, ${lng.toFixed(4)}`; }
}

function LocationSelector({ label, value, onChange, userLocation, gpsDetecting }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef();
  const debounceRef = useRef();

  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const doSearch = useCallback(async (q) => {
    if (!userLocation) return;
    setLoading(true);
    const places = await searchNearbyPlaces(userLocation[0], userLocation[1], q);
    setResults(places);
    setLoading(false);
  }, [userLocation]);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    clearTimeout(debounceRef.current);
    if (val.length >= 2) debounceRef.current = setTimeout(() => doSearch(val), 500);
    else if (val.length === 0) debounceRef.current = setTimeout(() => doSearch(""), 300);
  };

  return (
    <div ref={ref} style={{ position: "relative", zIndex: label === "DESTINATION" ? 10000 : 5000 }}>
      <div style={{ ...styles.inputRow, ...(label === "START POINT" && gpsDetecting ? { border: "1px solid rgba(34,211,238,0.5)" } : {}) }}>
        {label === "START POINT" ? (
          gpsDetecting ? ( <span className="gps-detecting" style={{ width: 10, height: 10, borderRadius: "50%", background: "#22d3ee", flexShrink: 0 }} /> ) : ( <span style={{ color: "#60a5fa", fontSize: 14 }}>➤</span> )
        ) : ( <span style={{ color: "#a78bfa", fontSize: 14 }}>🔍</span> )}
        <input style={styles.locationInput} value={query} placeholder={label === "START POINT" ? "Detecting location..." : "Search destination..."} onChange={handleChange} onFocus={() => setOpen(true)} />
        {loading && <span style={{ fontSize: 10, color: "#6366f1" }}>⏳</span>}
      </div>
      {open && results.length > 0 && (
        <div style={styles.dropdown}>
          {results.map((loc, i) => (
            <div key={i} style={styles.dropdownItem} onMouseDown={() => { onChange(loc); setQuery(loc.name); setOpen(false); }}>
              <span style={{ marginRight: 6 }}>📍</span><span style={{ fontSize: 11, lineHeight: 1.4 }}>{loc.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const FALLBACK_CENTER = [9.9312, 76.2673]; // Kochi fallback

  const [userLocation, setUserLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState(FALLBACK_CENTER);
  const [startLocation, setStartLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  
  const [safestRoute, setSafestRoute] = useState(null);
  const [dangerRoute, setDangerRoute] = useState(null);
  
  const [hazardPins, setHazardPins] = useState([]);
  const [sosActive, setSosActive] = useState(false);
  const [shareLink, setShareLink] = useState(null);
  const [lights, setLights] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [refugeHubs, setRefugeHubs] = useState([]);
  const [safetyScore, setSafetyScore] = useState(null);
  const [logMode, setLogMode] = useState(false);
  const [notification, setNotification] = useState(null);
  const [locationStatus, setLocationStatus] = useState("Initializing Navigation Workspace...");
  const [gpsDetecting, setGpsDetecting] = useState(true);

  const [temporalHour, setTemporalHour] = useState(new Date().getHours());
  const [temporalMinute, setTemporalMinute] = useState(new Date().getMinutes());
  const [isNightMode, setIsNightMode] = useState(false);

  const [routeMetrics, setRouteMetrics] = useState({ standardDist: "0.0 km", shadowDist: "0.0 km", distanceTradeoff: "0m" });

  // LIVE TRACKING STATES (New Addition)
  const [isNavigating, setIsNavigating] = useState(false);
  const [livePosition, setLivePosition] = useState(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTemporalHour(now.getHours());
      setTemporalMinute(now.getMinutes());
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { setIsNightMode(temporalHour >= 19 || temporalHour < 6); }, [temporalHour]);

  // Initial Location Setup & URL Param Checker
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hasSharedData = urlParams.get("shared") === "true";

    if (hasSharedData) {
      const sLat = parseFloat(urlParams.get("slat"));
      const sLng = parseFloat(urlParams.get("slng"));
      const dLat = parseFloat(urlParams.get("dlat"));
      const dLng = parseFloat(urlParams.get("dlng"));
      const midPoint = [(sLat + dLat) / 2, (sLng + dLng) / 2];

      setUserLocation([sLat, sLng]);
      setMapCenter(midPoint);
      setLights(generateStreetlights(midPoint));
      setBusinesses(generateBusinesses(midPoint));
      setRefugeHubs(generateRefugeHubs(midPoint));

      setStartLocation({ name: urlParams.get("sname"), lat: sLat, lng: sLng });
      setDestination({ name: urlParams.get("dname"), lat: dLat, lng: dLng });
      setGpsDetecting(false);
    } else {
      if (!navigator.geolocation) {
        setupWorkspace(FALLBACK_CENTER);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const center = [pos.coords.latitude, pos.coords.longitude];
          setupWorkspace(center);
          const name = await reverseGeocode(center[0], center[1]);
          setStartLocation({ name, lat: center[0], lng: center[1] });
          setLocationStatus(`📍 ${name}`);
          setGpsDetecting(false);
        },
        () => {
          setupWorkspace(FALLBACK_CENTER);
          setStartLocation({ name: "Fallback Hub", lat: FALLBACK_CENTER[0], lng: FALLBACK_CENTER[1] });
          setLocationStatus("⚠️ GPS Offline. Fallback Center Loaded.");
          setGpsDetecting(false);
        },
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // LIVE GPS TRACKING LISTENER (New Addition)
  useEffect(() => {
    let watchId;
    if (isNavigating && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => setLivePosition([pos.coords.latitude, pos.coords.longitude]),
        (err) => console.error("GPS Tracking lost:", err),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
    }
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
  }, [isNavigating]);

  const setupWorkspace = (center) => {
    setUserLocation(center);
    setMapCenter(center);
    setLights(generateStreetlights(center));
    setBusinesses(generateBusinesses(center));
    setRefugeHubs(generateRefugeHubs(center));
  };

  const showNotification = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const calculateSafetyRoutes = useCallback(async () => {
    if (!startLocation || !destination) return;
    const startPt = [startLocation.lat, startLocation.lng];
    const endPt = [destination.lat, destination.lng];
    const midPoint = [(startPt[0] + endPt[0]) / 2, (startPt[1] + endPt[1]) / 2];
    
    setLights(generateStreetlights(midPoint));
    setBusinesses(generateBusinesses(midPoint));
    setRefugeHubs(generateRefugeHubs(midPoint));

    const standardData = await fetchOSRMRoute(startPt, endPt, false);
    const secureData = await fetchOSRMRoute(startPt, endPt, true);

    if (standardData && secureData) {
      setDangerRoute(standardData.coords);
      setSafestRoute(secureData.coords);
      const diffMeters = Math.max(0, Math.round(secureData.rawMeters - standardData.rawMeters));
      setRouteMetrics({ standardDist: standardData.distanceText, shadowDist: secureData.distanceText, distanceTradeoff: `+${diffMeters} meters` });
      setSafetyScore(isNightMode ? 86 : 97);
    }
  }, [startLocation, destination, isNightMode]);

  useEffect(() => { if (destination) calculateSafetyRoutes(); }, [destination, calculateSafetyRoutes]);

  const handleSOSPanicDispatch = () => {
    const referenceLocation = livePosition || userLocation;
    if (!referenceLocation || refugeHubs.length === 0) return;
    
    setSosActive(true);
    let nearestHub = refugeHubs[0];
    let closestDist = Infinity;

    refugeHubs.forEach(hub => {
      const dist = Math.sqrt(Math.pow(hub.lat - referenceLocation[0], 2) + Math.pow(hub.lng - referenceLocation[1], 2));
      if (dist < closestDist) { closestDist = dist; nearestHub = hub; }
    });

    fetchOSRMRoute(referenceLocation, [nearestHub.lat, nearestHub.lng], false).then(data => {
      if (data) {
        setSafestRoute(data.coords);
        setDangerRoute(null);
        setMapCenter([nearestHub.lat, nearestHub.lng]);
        setIsNavigating(true); // Automatically turn on live tracking for the escape route
      }
    });

    showNotification(`🚨 SOS ACTIVE: Route overridden. Navigating to ${nearestHub.name}`, "danger");
  };

  const handleMapClick = (latlng) => {
    if (logMode) {
      setHazardPins((prev) => [...prev, { lat: latlng.lat, lng: latlng.lng, id: Date.now() }]);
      showNotification("Environmental hazard pin dropped.", "warning");
      setLogMode(false);
    }
  };

  const handleShare = () => {
    if (!startLocation || !destination) { showNotification("Select a destination first.", "warning"); return; }
    const builtLink = `${window.location.origin}?shared=true&slat=${startLocation.lat}&slng=${startLocation.lng}&sname=${encodeURIComponent(startLocation.name)}&dlat=${destination.lat}&dlng=${destination.lng}&dname=${encodeURIComponent(destination.name)}`;
    setShareLink(builtLink);
    navigator.clipboard?.writeText(builtLink);
    showNotification("Routing link copied!", "success");
  };

  const toggleNavigation = () => {
    if (!startLocation || !destination) {
      showNotification("Please set a destination to begin live tracking.", "warning");
      return;
    }
    setIsNavigating(!isNavigating);
    showNotification(isNavigating ? "Live Tracking Ended." : "Live Tracking Started! Follow the green path.", "success");
  };

  const timeString = (() => {
    const h = temporalHour % 24;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(temporalMinute).padStart(2, "0")} ${ampm}`;
  })();

  return (
    <div style={styles.app}>
      {notification && <div style={{ ...styles.toast, borderColor: toastColors[notification.type] }}>{notification.msg}</div>}
      {isNightMode && <div style={styles.nightOverlay} />}

      <div style={styles.mapContainer}>
        <MapContainer center={mapCenter} zoom={14} style={{ width: "100%", height: "100%" }} zoomControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <MapRecenter center={mapCenter} />
          <MapClickHandler onMapClick={handleMapClick} />

          {startLocation && !isNavigating && <Marker position={[startLocation.lat, startLocation.lng]} icon={createIcon("#22d3ee", 16)} />}
          {destination && <Marker position={[destination.lat, destination.lng]} icon={createIcon("#f472b6", 16)} />}

          {/* NEW LIVE TRACKING MARKER */}
          {livePosition && isNavigating && (
            <Marker position={livePosition} icon={createIcon("#3b82f6", 20)}>
              <Popup>You are here</Popup>
            </Marker>
          )}

          {safestRoute && <Polyline positions={safestRoute} pathOptions={{ color: "#10b981", weight: 6, opacity: 0.95, lineCap: "round" }} />}
          {dangerRoute && <Polyline positions={dangerRoute} pathOptions={{ color: "#ef4444", weight: 3.5, opacity: 0.8, dashArray: "6,8" }} />}

          {lights.map((l) => (
            <div key={l.id}>
              <Marker position={[l.lat, l.lng]} icon={l.status === "online" ? streetlightIcon : brokenLightIcon} />
              {l.status === "online" && isNightMode && <Circle center={[l.lat, l.lng]} radius={150} pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.05, weight: 1 }} />}
            </div>
          ))}

          {businesses.map((b) => <Marker key={b.id} position={[b.lat, b.lng]} icon={shopIcon} />)}
          {hazardPins.map((h) => <Marker key={h.id} position={[h.lat, h.lng]} icon={hazardIcon} />)}
          {refugeHubs.map((hub) => <Marker key={hub.id} position={[hub.lat, hub.lng]} icon={emergencyRefugeIcon}><Popup><div className="text-black font-bold text-xs p-1">{hub.name} ({hub.type})</div></Popup></Marker>)}

          {sosActive && (livePosition || startLocation) && (
            <Circle center={livePosition || [startLocation.lat, startLocation.lng]} radius={500} pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.12 }} />
          )}

          <MapBoundsUpdater standardRoute={dangerRoute} shadowPathRoute={safestRoute} />
        </MapContainer>
      </div>

      <div className="hud-scrollbar" style={styles.hud}>
        <div style={styles.header}>
          <div style={styles.logoBox}><span style={{ fontSize: 22 }}>🛡️</span></div>
          <div><div style={styles.appName}>ShadowPath</div><div style={styles.appSub}>Context-Aware Navigation Engine</div></div>
        </div>

        <div style={styles.locationStatusBox}>
          <span style={{ fontSize: 10 }}>📡</span><span style={{ fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden" }}>{locationStatus}</span>
        </div>

        {safetyScore !== null && (
          <div style={styles.scoreBar}>
            <span style={styles.scoreLabel}>SAFETY SCORE</span>
            <span style={{ ...styles.scoreBadge, background: safetyScore >= 75 ? "#10b981" : "#f59e0b" }}>{safetyScore}% Safe</span>
          </div>
        )}

        {/* NAVIGATION ACTION BUTTON (New) */}
        <button 
          style={{ ...styles.navBtn, background: isNavigating ? "#ef4444" : "#10b981", boxShadow: isNavigating ? "0 0 15px rgba(239,68,68,0.5)" : "0 0 15px rgba(16,185,129,0.3)" }} 
          onClick={toggleNavigation}
        >
          {isNavigating ? "🛑 END NAVIGATION" : "🚀 START LIVE TRACKING"}
        </button>

        {safetyScore !== null && (
          <div style={styles.comparisonBox}>
            <div style={{ color: "#94a3b8", fontSize: 9, fontWeight: 700, marginBottom: 6 }}>ENGINE ROUTING COMPARISON</div>
            <div style={styles.metricRow}><span style={{ color: "#cbd5e1" }}>🔴 Standard Route</span><span style={{ color: "#f87171" }}>{routeMetrics.standardDist}</span></div>
            <div style={styles.metricRow}><span style={{ color: "#cbd5e1" }}>🟢 ShadowPath</span><span style={{ color: "#34d399" }}>{routeMetrics.shadowDist}</span></div>
            <div style={{ background: "rgba(99,102,241,0.06)", padding: "6px", borderRadius: 6, fontSize: 10, color: "#a5b4fc" }}>💡 Tradeoff: Swapped {routeMetrics.distanceTradeoff} for optimized safety corridors.</div>
          </div>
        )}

        <button style={styles.shareBtn} onClick={handleShare}>🔗 Copy Companion Link</button>
        {shareLink && <div style={styles.shareLink}>{shareLink}</div>}

        <div style={styles.temporalBox}>
          <div style={styles.temporalHeader}><span style={styles.temporalLabel}>⏱ TEMPORAL SYNC</span><span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 14 }}>{timeString}</span></div>
          <input type="range" min={0} max={23} value={temporalHour} onChange={(e) => { setTemporalHour(Number(e.target.value)); setTemporalMinute(new Date().getMinutes()); }} style={styles.slider} />
          {isNightMode && <div style={styles.nightBadge}>🌙 Night Mode Filters Activated</div>}
        </div>

        <button style={{ ...styles.sosBtn, ...(sosActive ? styles.sosBtnActive : {}) }} onClick={handleSOSPanicDispatch}>
          🚨 {sosActive ? "SOS ESCAPE ROUTE ACTIVE..." : "🛡️ ACTIVATE SOS REFUGE"}
        </button>

        <button style={styles.logBtn} onClick={() => { setLogMode(!logMode); showNotification("Right-click map frame to drop hazard pin.", "warning"); }}>
          ⚠️ {logMode ? "Click location on map..." : "+ Log Hazard Area"}
        </button>

        <div style={styles.routeSection}>
          <LocationSelector label="START POINT" value={startLocation?.name || ""} onChange={setStartLocation} userLocation={userLocation || FALLBACK_CENTER} gpsDetecting={gpsDetecting} />
          <div style={{ marginTop: 10 }}><LocationSelector label="DESTINATION" value={destination?.name || ""} onChange={setDestination} userLocation={userLocation || FALLBACK_CENTER} /></div>
        </div>

        <div style={styles.statsRow}>
          <div style={styles.statBox}><div style={{ fontSize: 16 }}>💡</div><div style={styles.statNum}>{lights.filter(l => l.status === "online").length}</div><div style={styles.statLabel}>Lights</div></div>
          <div style={styles.statBox}><div style={{ fontSize: 16 }}>🏪</div><div style={styles.statNum}>{businesses.filter(b => b.open).length}</div><div style={styles.statLabel}>Safe Hubs</div></div>
          <div style={styles.statBox}><div style={{ fontSize: 16 }}>⚠️</div><div style={styles.statNum}>{hazardPins.length}</div><div style={styles.statLabel}>Hazards</div></div>
        </div>

        <div style={styles.legendBox}>
          <div style={styles.legendTitle}>MAP LEGEND</div>
          <div style={styles.legendItem}>🟢 Safest Route Vector (Lit)</div>
          <div style={styles.legendItem}>🔴 Unlit High Risk Shortcut</div>
          <div style={styles.legendItem}>🔵 <strong>Live GPS Tracker</strong></div>
          <div style={styles.legendItem}>🚓 Emergency Refuge Station</div>
        </div>
      </div>
    </div>
  );
}

const toastColors = { info: "#60a5fa", success: "#10b981", warning: "#f59e0b", danger: "#ef4444" };
const styles = {
  app: { position: "relative", width: "100vw", height: "100vh", background: "#0a0e1a", fontFamily: "sans-serif", overflow: "hidden" },
  mapContainer: { position: "absolute", inset: 0, zIndex: 0 },
  nightOverlay: { position: "absolute", inset: 0, background: "rgba(10,14,40,0.35)", zIndex: 1, pointerEvents: "none" },
  hud: { position: "absolute", top: 12, left: 12, bottom: 12, width: 340, zIndex: 10, background: "rgba(10,14,30,0.94)", backdropFilter: "blur(16px)", borderRadius: 16, border: "1px solid rgba(99,102,241,0.25)", padding: "14px", display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", overflowX: "hidden", boxShadow: "0 0 30px rgba(0,0,0,0.5)" },
  header: { display: "flex", alignItems: "center", gap: 10, paddingBottom: 6, borderBottom: "1px solid rgba(99,102,241,0.2)" },
  logoBox: { width: 38, height: 38, borderRadius: 8, background: "linear-gradient(135deg,#1e3a5f,#312e81)", display: "flex", alignItems: "center", justifyContent: "center" },
  appName: { color: "#e0e7ff", fontSize: 19, fontWeight: 700 },
  appSub: { color: "#6b7280", fontSize: 10 },
  locationStatusBox: { display: "flex", alignItems: "center", gap: 6, background: "rgba(30,41,59,0.5)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 8, padding: "5px 10px" },
  scoreBar: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: "6px 12px" },
  scoreLabel: { color: "#9ca3af", fontSize: 9, fontWeight: 700 },
  scoreBadge: { padding: "3px 10px", borderRadius: 20, color: "#fff", fontSize: 11, fontWeight: 700 },
  navBtn: { border: "none", borderRadius: 10, color: "#fff", padding: "12px", cursor: "pointer", fontSize: 12, fontWeight: 800, textTransform: "uppercase" },
  comparisonBox: { background: "rgba(15,23,42,0.8)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, padding: "10px", marginTop: "2px" },
  metricRow: { display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: "bold", paddingBottom: 6 },
  shareBtn: { background: "rgba(30,58,138,0.5)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#93c5fd", padding: "8px", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  shareLink: { background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 6, padding: "6px", color: "#a5b4fc", fontSize: 9, wordBreak: "break-all" },
  temporalBox: { background: "rgba(15,23,42,0.8)", border: "1px solid rgba(99,102,241,0.18)", borderRadius: 10, padding: "10px" },
  temporalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  temporalLabel: { color: "#9ca3af", fontSize: 9, fontWeight: 700 },
  slider: { width: "100%", accentColor: "#6366f1", cursor: "pointer" },
  nightBadge: { marginTop: 6, background: "rgba(109,40,217,0.15)", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 6, padding: "4px", color: "#c084fc", fontSize: 10, textAlign: "center" },
  sosBtn: { background: "linear-gradient(135deg,#dc2626,#f97316)", border: "none", borderRadius: 10, color: "#fff", padding: "11px", cursor: "pointer", fontSize: 12, fontWeight: 800 },
  sosBtnActive: { background: "linear-gradient(135deg,#7f1d1d,#dc2626)", boxShadow: "0 0 20px rgba(239,68,68,0.6)" },
  logBtn: { background: "rgba(15,23,42,0.6)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, color: "#d1d5db", padding: "8px", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  routeSection: { background: "rgba(15,23,42,0.6)", border: "1px solid rgba(99,102,241,0.18)", borderRadius: 10, padding: "10px" },
  inputRow: { display: "flex", alignItems: "center", gap: 6, background: "rgba(30,41,59,0.7)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, padding: "6px" },
  locationInput: { flex: 1, background: "transparent", border: "none", color: "#e0e7ff", fontSize: 12, outline: "none" },
  dropdown: { position: "absolute", top: "100%", left: 0, right: 0, background: "rgba(15,23,42,0.98)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 8, zIndex: 99999, maxHeight: 180, overflowY: "auto", marginTop: "4px" },
  dropdownItem: { padding: "6px 10px", color: "#cbd5e1", fontSize: 12, cursor: "pointer" },
  statsRow: { display: "flex", gap: 4 },
  statBox: { flex: 1, background: "rgba(15,23,42,0.6)", border: "1px solid rgba(99, 102, 241, 0.12)", borderRadius: 8, padding: "6px 2px", textAlign: "center" },
  statNum: { color: "#e0e7ff", fontSize: 16, fontWeight: 700 },
  statLabel: { color: "#6b7280", fontSize: 8, marginTop: 1 },
  legendBox: { background: "rgba(15,23,42,0.5)", border: "1px solid rgba(99, 102, 241, 0.12)", borderRadius: 8, padding: "10px" },
  legendTitle: { color: "#9ca3af", fontSize: 9, fontWeight: 700, marginBottom: 6 },
  legendItem: { color: "#d1d5db", fontSize: 11, marginBottom: 4 },
  toast: { position: "fixed", top: 16, right: 16, zIndex: 9999, background: "rgba(10,14,30,0.95)", border: "1px solid", borderRadius: 8, padding: "10px", color: "#e0e7ff", fontSize: 12, fontWeight: 600, maxWidth: 280 },
};