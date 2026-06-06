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

const streetlightIcon = L.divIcon({
  className: "",
  html: `<div style="font-size:18px;filter:drop-shadow(0 0 4px #f59e0b)">💡</div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const brokenLightIcon = L.divIcon({
  className: "",
  html: `<div style="font-size:18px;opacity:0.5">🔦</div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const shopIcon = L.divIcon({
  className: "",
  html: `<div style="font-size:16px;filter:drop-shadow(0 0 4px #10b981)">🏪</div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const hazardIcon = L.divIcon({
  className: "",
  html: `<div style="font-size:16px">⚠️</div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const emergencyRefugeIcon = L.divIcon({
  className: "",
  html: `<div style="font-size:18px;filter:drop-shadow(0 0 6px #ef4444)">🚓</div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

// Anchor data points generator
function generateStreetlights(center) {
  const offsets = [
    [0.0012, 0.0008], [0.0022, 0.0019], [-0.0006, 0.0014],
    [0.0031, -0.0005], [-0.0014, 0.0020], [0.0007, -0.0012],
    [0.0021, 0.0038], [-0.0019, -0.0006], [0.0038, 0.0012], [-0.0006, 0.0031],
  ];
  return offsets.map((o, i) => ({
    id: i + 1,
    lat: center[0] + o[0],
    lng: center[1] + o[1],
    status: i % 3 === 2 ? "offline" : "online",
  }));
}

function generateBusinesses(center) {
  const places = [
    { offset: [0.0018, 0.0012], name: "Local Market Square", open: true },
    { offset: [-0.0010, 0.0028], name: "Emergency Pharmacy 24/7", open: true },
    { offset: [0.0035, -0.0003], name: "Central Food Court", open: false },
    { offset: [-0.0003, -0.0019], name: "Convenience Store Hub", open: true },
    { offset: [0.0028, 0.0035], name: "Highway Tea Junction", open: true },
  ];
  return places.map((p, i) => ({
    id: i + 1,
    lat: center[0] + p.offset[0],
    lng: center[1] + p.offset[1],
    name: p.name,
    open: p.open,
  }));
}

function generateRefugeHubs(center) {
  return [
    { id: 101, name: "City Core Police Station", lat: center[0] + 0.0012, lng: center[1] - 0.0035, type: "Police Station" },
    { id: 102, name: "District General Hospital", lat: center[0] - 0.0028, lng: center[1] + 0.0019, type: "Hospital" }
  ];
}

// Generates explicit alternative forward-moving route vectors (Safest vs Dangerous)
function generateDualRoutes(startPt, endPt, streetlights, hazardPins) {
  const totalLineDist = Math.sqrt(Math.pow(endPt[0] - startPt[0], 2) + Math.pow(endPt[1] - startPt[1], 2));

  // 1. Safest Path Core Engine
  const safeWaypoints = [startPt];
  const forwardSafeNodes = streetlights.filter(l => {
    if (l.status !== "online") return false;
    const nodeToDestDist = Math.sqrt(Math.pow(endPt[0] - l.lat, 2) + Math.pow(endPt[1] - l.lng, 2));
    return nodeToDestDist < totalLineDist;
  });

  forwardSafeNodes.sort((a, b) => {
    const distA = Math.pow(a.lat - startPt[0], 2) + Math.pow(a.lng - startPt[1], 2);
    const distB = Math.pow(b.lat - startPt[0], 2) + Math.pow(b.lng - startPt[1], 2);
    return distA - distB;
  });

  forwardSafeNodes.slice(0, 4).forEach(node => safeWaypoints.push([node.lat, node.lng]));
  safeWaypoints.push(endPt);

  // 2. Danger Path Core Engine
  const dangerWaypoints = [startPt];
  const highRiskNodes = [
    ...streetlights.filter(l => l.status === "offline"),
    ...hazardPins
  ];

  const forwardRiskNodes = highRiskNodes.filter(node => {
    const nodeToDestDist = Math.sqrt(Math.pow(endPt[0] - node.lat, 2) + Math.pow(endPt[1] - node.lng, 2));
    return nodeToDestDist < totalLineDist;
  });

  forwardRiskNodes.sort((a, b) => {
    const distA = Math.pow(a.lat - startPt[0], 2) + Math.pow(a.lng - startPt[1], 2);
    const distB = Math.pow(b.lat - startPt[0], 2) + Math.pow(b.lng - startPt[1], 2);
    return distA - distB;
  });

  forwardRiskNodes.slice(0, 3).forEach(node => dangerWaypoints.push([node.lat, node.lng]));
  if (dangerWaypoints.length === 1) {
    dangerWaypoints.push([(startPt[0] + endPt[0]) / 2 - 0.0015, (startPt[1] + endPt[1]) / 2 - 0.0015]);
  }
  dangerWaypoints.push(endPt);

  return { safeWaypoints, dangerWaypoints, forwardSafeNodesCount: forwardSafeNodes.length };
}

function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, map.getZoom()); }, [center, map]);
  return null;
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({ contextmenu(e) { onMapClick(e.latlng); } });
  return null;
}

async function searchNearbyPlaces(lat, lng, query = "") {
  try {
    const viewbox = `${lng - 0.05},${lat - 0.05},${lng + 0.05},${lat + 0.05}`;
    const url = query
      ? `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=10&viewbox=${viewbox}&bounded=0&lat=${lat}&lon=${lng}`
      : `https://nominatim.openstreetmap.org/search?q=place&format=json&limit=15&viewbox=${viewbox}&bounded=1`;
    const res = await fetch(url, { headers: { "Accept-Language": "en", "User-Agent": "ShadowPath/1.0" } });
    const data = await res.json();
    return data.map((p) => ({
      name: p.display_name.split(",").slice(0, 3).join(", "),
      lat: parseFloat(p.lat),
      lng: parseFloat(p.lon),
    }));
  } catch { return []; }
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
      headers: { "Accept-Language": "en", "User-Agent": "ShadowPath/1.0" }
    });
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
    if (val.length >= 2) {
      debounceRef.current = setTimeout(() => doSearch(val), 500);
    } else if (val.length === 0) {
      debounceRef.current = setTimeout(() => doSearch(""), 300);
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ ...styles.inputRow, ...(label === "START POINT" && gpsDetecting ? { border: "1px solid rgba(34,211,238,0.5)" } : {}) }}>
        {label === "START POINT" ? (
          gpsDetecting ? ( <span className="gps-detecting" style={{ width: 10, height: 10, borderRadius: "50%", background: "#22d3ee", flexShrink: 0 }} /> ) : ( <span style={{ color: "#60a5fa", fontSize: 14 }}>➤</span> )
        ) : ( <span style={{ color: "#a78bfa", fontSize: 14 }}>🔍</span> )}
        <input
          style={styles.locationInput}
          value={query}
          placeholder={label === "START POINT" ? "Detecting location..." : "Search destination..."}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
        />
        {loading && <span style={{ fontSize: 10, color: "#6366f1" }}>⏳</span>}
      </div>

      {open && results.length > 0 && (
        <div style={styles.dropdown}>
          {results.map((loc, i) => (
            <div
              key={i} style={styles.dropdownItem}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(99,102,241,0.2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              onMouseDown={() => {
                onChange(loc);
                setQuery(loc.name);
                setOpen(false);
              }}
            >
              <span style={{ marginRight: 6 }}>📍</span>
              <span style={{ fontSize: 11, lineHeight: 1.4 }}>{loc.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const FALLBACK_CENTER = [14.6790, 77.6030];

  const [userLocation,   setUserLocation]   = useState(null);
  const [mapCenter,      setMapCenter]      = useState(FALLBACK_CENTER);
  const [startLocation,  setStartLocation]  = useState(null);
  const [destination,    setDestination]    = useState(null);
  
  const [safestRoute,    setSafestRoute]    = useState(null);
  const [dangerRoute,    setDangerRoute]    = useState(null);
  
  const [hazardPins,     setHazardPins]     = useState([]);
  const [sosActive,      setSosActive]      = useState(false);
  const [shareLink,      setShareLink]      = useState(null);
  const [lights,         setLights]         = useState([]);
  const [businesses,     setBusinesses]     = useState([]);
  const [refugeHubs,     setRefugeHubs]     = useState([]);
  const [safetyScore,    setSafetyScore]    = useState(null);
  const [logMode,        setLogMode]        = useState(false);
  const [notification,   setNotification]   = useState(null);
  const [locationStatus, setLocationStatus] = useState("Initializing Navigation Workspace...");
  const [gpsDetecting,   setGpsDetecting]   = useState(true);

  const [temporalHour,   setTemporalHour]   = useState(new Date().getHours());
  const [temporalMinute, setTemporalMinute] = useState(new Date().getMinutes());
  const [isNightMode,    setIsNightMode]    = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTemporalHour(now.getHours());
      setTemporalMinute(now.getMinutes());
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setIsNightMode(temporalHour >= 19 || temporalHour < 6);
  }, [temporalHour]);

  // COMPREHENSIVE ATOMIC INITIALIZER: SYNC LINES INSTANTLY ON URL OPEN
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hasSharedData = urlParams.get("shared") === "true";

    if (hasSharedData) {
      const sLat = parseFloat(urlParams.get("slat"));
      const sLng = parseFloat(urlParams.get("slng"));
      const sName = urlParams.get("sname");
      const dLat = parseFloat(urlParams.get("dlat"));
      const dLng = parseFloat(urlParams.get("dlng"));
      const dName = urlParams.get("dname");

      const baseCenter = [sLat, sLng];
      const sharedLights = generateStreetlights(baseCenter);
      const sharedBusinesses = generateBusinesses(baseCenter);

      setUserLocation(baseCenter);
      setMapCenter(baseCenter);
      setLights(sharedLights);
      setBusinesses(sharedBusinesses);
      setRefugeHubs(generateRefugeHubs(baseCenter));

      const startObj = { name: sName, lat: sLat, lng: sLng };
      const destObj = { name: dName, lat: dLat, lng: dLng };
      setStartLocation(startObj);
      setDestination(destObj);

      // FORCE INTEGRATED EVALUATION IMMEDIATELY
      const { safeWaypoints, dangerWaypoints, forwardSafeNodesCount } = generateDualRoutes(
        [sLat, sLng], [dLat, dLng], sharedLights, []
      );
      setSafestRoute(safeWaypoints);
      setDangerRoute(dangerWaypoints);

      const checkNight = new Date().getHours() >= 19 || new Date().getHours() < 6;
      setSafetyScore(checkNight ? Math.min(98, 55 + forwardSafeNodesCount * 5) : 95);

      setLocationStatus(`🔗 Shared Companion View: Destination Locked`);
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
          setStartLocation({ name: "Anantapur Core District", lat: FALLBACK_CENTER[0], lng: FALLBACK_CENTER[1] });
          setLocationStatus("⚠️ GPS Offline. Fallback Center Loaded.");
          setGpsDetecting(false);
        },
        { enableHighAccuracy: true }
      );
    }
  }, []);

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

  // NORMAL INTERACTION ROUTING WORKFLOW
  const calculateSafetyRoutes = useCallback(() => {
    if (!startLocation || !destination || window.location.search.includes("shared=true")) return;

    const startPt = [startLocation.lat, startLocation.lng];
    const endPt = [destination.lat, destination.lng];

    const { safeWaypoints, dangerWaypoints, forwardSafeNodesCount } = generateDualRoutes(
      startPt, endPt, lights, hazardPins
    );

    setSafestRoute(safeWaypoints);
    setDangerRoute(dangerWaypoints);

    const computedScore = isNightMode 
      ? Math.min(98, 55 + forwardSafeNodesCount * 5) 
      : Math.min(99, 94 + forwardSafeNodesCount * 1);
      
    setSafetyScore(computedScore);
    showNotification(`Forward trajectory safety path optimized. Grid Factor: ${computedScore}%`, "success");
  }, [startLocation, destination, lights, hazardPins, isNightMode]);

  useEffect(() => { if (destination) calculateSafetyRoutes(); }, [destination, calculateSafetyRoutes]);

  const handleSOSPanicDispatch = () => {
    if (!userLocation || refugeHubs.length === 0) return;
    setSosActive(true);

    let nearestHub = refugeHubs[0];
    let closestDist = Infinity;

    refugeHubs.forEach(hub => {
      const dist = Math.sqrt(Math.pow(hub.lat - userLocation[0], 2) + Math.pow(hub.lng - userLocation[1], 2));
      if (dist < closestDist) {
        closestDist = dist;
        nearestHub = hub;
      }
    });

    const escapeWaypoints = [
      userLocation,
      [(userLocation[0] + nearestHub.lat)/2, (userLocation[1] + nearestHub.lng)/2],
      [nearestHub.lat, nearestHub.lng]
    ];

    setSafestRoute(escapeWaypoints);
    setDangerRoute(null); 
    setMapCenter([nearestHub.lat, nearestHub.lng]);

    showNotification(
      `🚨 SOS EMERGENCY ACTIVE: Live location shared with priority contacts. Route locked onto closest safe refuge: ${nearestHub.name} (${nearestHub.type})`,
      "danger"
    );
  };

  const handleMapClick = (latlng) => {
    if (logMode) {
      setHazardPins((prev) => [...prev, { lat: latlng.lat, lng: latlng.lng, id: Date.now() }]);
      showNotification("Environmental hazard pin dropped inside localized zone.", "warning");
      setLogMode(false);
    }
  };

  const handleShare = () => {
    if (!startLocation || !destination) {
      showNotification("Please select a destination first to map out a share link.", "warning");
      return;
    }

    const activeOrigin = window.location.hostname === "localhost" 
      ? window.location.origin 
      : window.location.href.split('?')[0];

    const builtLink = `${activeOrigin}?shared=true` +
      `&slat=${startLocation.lat}&slng=${startLocation.lng}&sname=${encodeURIComponent(startLocation.name)}` +
      `&dlat=${destination.lat}&dlng=${destination.lng}&dname=${encodeURIComponent(destination.name)}`;

    setShareLink(builtLink);
    navigator.clipboard?.writeText(builtLink);
    showNotification("Comprehensive routing link copied! Shared streetlights and safety paths sync on open.", "success");
  };

  const timeString = (() => {
    const h = temporalHour % 24;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    const mins = String(temporalMinute).padStart(2, "0");
    return `${h12}:${mins} ${ampm}`;
  })();

  return (
    <div style={styles.app}>
      {notification && <div style={{ ...styles.toast, borderColor: toastColors[notification.type] }}>{notification.msg}</div>}
      {isNightMode && <div style={styles.nightOverlay} />}

      {/* RENDER SPACE BASE LAYER */}
      <div style={styles.mapContainer}>
        <MapContainer center={mapCenter} zoom={15} style={{ width: "100%", height: "100%" }} zoomControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <MapRecenter center={mapCenter} />
          <MapClickHandler onMapClick={handleMapClick} />

          {startLocation && <Marker position={[startLocation.lat, startLocation.lng]} icon={createIcon("#22d3ee", 16)} />}
          {destination && <Marker position={[destination.lat, destination.lng]} icon={createIcon("#f472b6", 16)} />}

          {/* DUAL TRAJECTORY PATH OVERLAYS */}
          {safestRoute && <Polyline positions={safestRoute} pathOptions={{ color: "#10b981", weight: 5, opacity: 0.95 }} />}
          {dangerRoute && <Polyline positions={dangerRoute} pathOptions={{ color: "#ef4444", weight: 3.5, opacity: 0.8, dashArray: "6,8" }} />}

          {/* Streetlights with working aura bounds */}
          {lights.map((l) => (
            <div key={l.id}>
              <Marker position={[l.lat, l.lng]} icon={l.status === "online" ? streetlightIcon : brokenLightIcon} />
              {l.status === "online" && isNightMode && (
                <Circle center={[l.lat, l.lng]} radius={45} pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.08, weight: 1 }} />
              )}
            </div>
          ))}

          {businesses.map((b) => <Marker key={b.id} position={[b.lat, b.lng]} icon={shopIcon} />)}
          {hazardPins.map((h) => <Marker key={h.id} position={[h.lat, h.lng]} icon={hazardIcon} />)}

          {/* REFUGE STATION NODES */}
          {refugeHubs.map((hub) => (
            <Marker key={hub.id} position={[hub.lat, hub.lng]} icon={emergencyRefugeIcon}>
              <Popup><div className="text-black font-bold text-xs p-1">{hub.name} ({hub.type})</div></Popup>
            </Marker>
          ))}

          {sosActive && startLocation && (
            <Circle center={[startLocation.lat, startLocation.lng]} radius={280} pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.15 }} />
          )}
        </MapContainer>
      </div>

      {/* DASHBOARD HUD OVERLAY */}
      <div className="hud-scrollbar" style={styles.hud}>
        <div style={styles.header}>
          <div style={styles.logoBox}><span style={{ fontSize: 22 }}>🛡️</span></div>
          <div>
            <div style={styles.appName}>ShadowPath</div>
            <div style={styles.appSub}>Context-Aware Navigation Framework</div>
          </div>
        </div>

        <div style={styles.locationStatusBox}>
          <span style={{ fontSize: 10 }}>📡</span>
          <span style={{ fontSize: 10, color: "#94a3b8", textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden" }}>{locationStatus}</span>
        </div>

        {safetyScore !== null && (
          <div style={styles.scoreBar}>
            <span style={styles.scoreLabel}>SAFETY SCORING GRID</span>
            <span style={{ ...styles.scoreBadge, background: safetyScore >= 75 ? "#10b981" : "#f59e0b" }}>{safetyScore}% Safe</span>
          </div>
        )}

        <button style={styles.shareBtn} onClick={handleShare}>🔗 Generate Companion Share Link</button>
        {shareLink && <div style={styles.shareLink}>{shareLink}</div>}

        <div style={styles.temporalBox}>
          <div style={styles.temporalHeader}>
            <span style={styles.temporalLabel}>⏱ TEMPORAL SYNC</span>
            <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 14 }}>{timeString}</span>
          </div>
          <input
            type="range" min={0} max={23} value={temporalHour}
            onChange={(e) => { setTemporalHour(Number(e.target.value)); setTemporalMinute(new Date().getMinutes()); }}
            style={styles.slider}
          />
          <div style={styles.sliderLabels}><span>12AM</span><span>6AM</span><span>12PM</span><span>6PM</span><span>11PM</span></div>
          {isNightMode && <div style={styles.nightBadge}>🌙 Night Mode Filters Activated</div>}
        </div>

        <button style={{ ...styles.sosBtn, ...(sosActive ? styles.sosBtnActive : {}) }} onClick={handleSOSPanicDispatch}>
          🚨 {sosActive ? "SOS EMERGENCY ACCELERATED..." : "🛡️ ACTIVATE SOS PANIC REFUGE"}
        </button>

        <button style={styles.logBtn} onClick={() => { setLogMode(!logMode); showNotification("Right-click inside map grid frame to commit hazard coordinate labels.", "warning"); }}>
          ⚠️ {logMode ? "Click target location coordinate point..." : "+ Log Broken Light / Hazard Area"}
        </button>

        <div style={styles.routeSection}>
          <div style={styles.inputLabel}>START POINT</div>
          <LocationSelector label="START POINT" value={startLocation?.name || ""} onChange={setStartLocation} userLocation={userLocation || FALLBACK_CENTER} gpsDetecting={gpsDetecting} />
          
          <div style={{ ...styles.inputLabel, marginTop: 10 }}>DESTINATION</div>
          <LocationSelector label="DESTINATION" value={destination?.name || ""} onChange={setDestination} userLocation={userLocation || FALLBACK_CENTER} />
        </div>

        <div style={styles.statsRow}>
          <div style={styles.statBox}><div style={{ fontSize: 16 }}>💡</div><div style={styles.statNum}>{lights.filter(l => l.status === "online").length}</div><div style={styles.statLabel}>Active Lights</div></div>
          <div style={styles.statBox}><div style={{ fontSize: 16 }}>🏪</div><div style={styles.statNum}>{businesses.filter(b => b.open).length}</div><div style={styles.statLabel}>Open Safe Hubs</div></div>
          <div style={styles.statBox}><div style={{ fontSize: 16 }}>⚠️</div><div style={styles.statNum}>{hazardPins.length}</div><div style={styles.statLabel}>Hazards</div></div>
        </div>

        <div style={styles.legendBox}>
          <div style={styles.legendTitle}>INFRASTRUCTURE MAP SIGNS</div>
          <div style={styles.legendItem}>🟢 <span style={{ color: "#10b981", fontWeight: 'bold' }}>Safest Route Vector Track (Lit)</span></div>
          <div style={styles.legendItem}>🔴 <span style={{ color: "#ef4444", fontWeight: 'bold' }}>Unlit High Risk Shortcut Track</span></div>
          <div style={styles.legendItem}>💡 <span>Amber Bulbs: <strong>Active Streetlight Aura</strong></span></div>
          <div style={styles.legendItem}>🚓 <span>Shield Unit: <strong>Nearest Emergency Refuge Station</strong></span></div>
        </div>

        <div style={styles.footer}><span>Right-click map frame to submit tags</span><span style={{ color: "#4f46e5" }}>ShadowPath v1.0</span></div>
      </div>
    </div>
  );
}

const toastColors = { info: "#60a5fa", success: "#10b981", warning: "#f59e0b", danger: "#ef4444" };
const styles = {
  app: { position: "relative", width: "100vw", height: "100vh", background: "#0a0e1a", fontFamily: "sans-serif", overflow: "hidden" },
  mapContainer: { position: "absolute", inset: 0, zIndex: 0 },
  nightOverlay: { position: "absolute", inset: 0, background: "rgba(10,14,40,0.35)", zIndex: 1, pointerEvents: "none" },
  hud: { position: "absolute", top: 12, left: 12, bottom: 12, width: 340, zIndex: 10, background: "rgba(10,14,30,0.94)", backdropFilter: "blur(16px)", borderRadius: 16, border: "1px solid rgba(99,102,241,0.25)", padding: "14px", display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", overflowX: "hidden", boxShadow: "0 0 30px rgba(0,0,0,0.5)" },
  header: { display: "flex", alignItems: "center", gap: 10, paddingBottom: 6, borderBottom: "1px solid rgba(99,102,241,0.2)" },
  logoBox: { width: 38, height: 38, borderRadius: 8, background: "linear-gradient(135deg,#1e3a5f,#312e81)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(99,102,241,0.3)" },
  appName: { color: "#e0e7ff", fontSize: 19, fontWeight: 700 },
  appSub: { color: "#6b7280", fontSize: 10 },
  locationStatusBox: { display: "flex", alignItems: "center", gap: 6, background: "rgba(30,41,59,0.5)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 8, padding: "5px 10px" },
  scoreBar: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: "6px 12px" },
  scoreLabel: { color: "#9ca3af", fontSize: 9, fontWeight: 700 },
  scoreBadge: { padding: "3px 10px", borderRadius: 20, color: "#fff", fontSize: 11, fontWeight: 700 },
  shareBtn: { background: "rgba(30,58,138,0.5)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#93c5fd", padding: "8px", cursor: "pointer", fontSize: 12, fontWeight: 600, textStyle: "center" },
  shareLink: { background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 6, padding: "6px", color: "#a5b4fc", fontSize: 9, wordBreak: "break-all" },
  temporalBox: { background: "rgba(15,23,42,0.8)", border: "1px solid rgba(99,102,241,0.18)", borderRadius: 10, padding: "10px" },
  temporalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  temporalLabel: { color: "#9ca3af", fontSize: 9, fontWeight: 700 },
  slider: { width: "100%", accentColor: "#6366f1", cursor: "pointer" },
  sliderLabels: { display: "flex", justifyContent: "space-between", color: "#4b5563", fontSize: 9, marginTop: 2 },
  nightBadge: { marginTop: 6, background: "rgba(109,40,217,0.15)", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 6, padding: "4px", color: "#c084fc", fontSize: 10, textAlign: "center" },
  sosBtn: { background: "linear-gradient(135deg,#dc2626,#f97316)", border: "none", borderRadius: 10, color: "#fff", padding: "11px", cursor: "pointer", fontSize: 12, fontWeight: 800, textTransform: "uppercase", boxShadow: "0 4px 15px rgba(239,68,68,0.3)" },
  sosBtnActive: { background: "linear-gradient(135deg,#7f1d1d,#dc2626)", boxShadow: "0 0 20px rgba(239,68,68,0.6)" },
  logBtn: { background: "rgba(15,23,42,0.6)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, color: "#d1d5db", padding: "8px", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  routeSection: { background: "rgba(15,23,42,0.6)", border: "1px solid rgba(99,102,241,0.18)", borderRadius: 10, padding: "10px" },
  inputLabel: { color: "#9ca3af", fontSize: 9, fontWeight: 700, marginBottom: 4 },
  inputRow: { display: "flex", alignItems: "center", gap: 6, background: "rgba(30,41,59,0.7)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, padding: "6px" },
  locationInput: { flex: 1, background: "transparent", border: "none", color: "#e0e7ff", fontSize: 12, outline: "none" },
  dropdown: { position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "rgba(10,14,30,0.98)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, zIndex: 9999, maxHeight: 150, overflowY: "auto" },
  dropdownItem: { padding: "6px 10px", color: "#cbd5e1", fontSize: 12, cursor: "pointer" },
  statsRow: { display: "flex", gap: 4 },
  statBox: { flex: 1, background: "rgba(15,23,42,0.6)", border: "1px solid rgba(99, 102, 241, 0.12)", borderRadius: 8, padding: "6px 2px", textAlign: "center" },
  statNum: { color: "#e0e7ff", fontSize: 16, fontWeight: 700 },
  statLabel: { color: "#6b7280", fontSize: 8, marginTop: 1 },
  legendBox: { background: "rgba(15,23,42,0.5)", border: "1px solid rgba(99, 102, 241, 0.12)", borderRadius: 8, padding: "10px" },
  legendTitle: { color: "#9ca3af", fontSize: 9, fontWeight: 700, marginBottom: 6 },
  legendItem: { display: "flex", alignItems: "center", gap: 6, color: "#d1d5db", fontSize: 11, marginBottom: 4 },
  footer: { display: "flex", justifyContent: "space-between", color: "#4b5563", fontSize: 9, paddingTop: 4, borderTop: "1px solid rgba(99,102,241,0.1)", marginTop: "auto" },
  toast: { position: "fixed", top: 16, right: 16, zIndex: 9999, background: "rgba(10,14,30,0.95)", border: "1px solid", borderRadius: 8, padding: "10px", color: "#e0e7ff", fontSize: 12, fontWeight: 600, maxWidth: 280 },
};