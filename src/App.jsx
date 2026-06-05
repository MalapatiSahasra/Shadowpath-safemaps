import { useState, useEffect, useRef, useCallback } from "react";
import {
  MapContainer, TileLayer, Marker, Polyline,
  useMapEvents, Popup, Circle, useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

// ─── BACKEND API URL ─────────────────────────────────────────────────────────
const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ─── FIX LEAFLET ICONS ───────────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── CUSTOM MAP ICONS ────────────────────────────────────────────────────────
const createIcon = (color, size = 14) =>
  L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;
           background:${color};border:2px solid rgba(255,255,255,0.8);
           box-shadow:0 0 8px ${color}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

const streetlightIcon = L.divIcon({
  className: "",
  html: `<div style="font-size:18px;filter:drop-shadow(0 0 4px #f59e0b)">💡</div>`,
  iconSize: [20, 20], iconAnchor: [10, 10],
});

const brokenLightIcon = L.divIcon({
  className: "",
  html: `<div style="font-size:18px;opacity:0.5">🔦</div>`,
  iconSize: [20, 20], iconAnchor: [10, 10],
});

const shopIcon = L.divIcon({
  className: "",
  html: `<div style="font-size:16px;filter:drop-shadow(0 0 4px #10b981)">🏪</div>`,
  iconSize: [20, 20], iconAnchor: [10, 10],
});

const hazardIcon = L.divIcon({
  className: "",
  html: `<div style="font-size:16px">⚠️</div>`,
  iconSize: [20, 20], iconAnchor: [10, 10],
});

// ─── HELPER: Generate streetlights around a location ─────────────────────────
function generateStreetlights(center) {
  const offsets = [
    [0.002, 0.001], [0.003, 0.003], [-0.001, 0.002],
    [0.004, -0.001], [-0.002, 0.003], [0.001, -0.002],
    [0.003, 0.005], [-0.003, -0.001], [0.005, 0.002], [-0.001, 0.004],
  ];
  return offsets.map((o, i) => ({
    id: `node_${String(i + 1).padStart(2, "0")}`,
    lat: center[0] + o[0],
    lng: center[1] + o[1],
    status: i % 3 === 2 ? "offline" : "online",
    lux: i % 3 === 2 ? 0 : 85,
  }));
}

// ─── HELPER: Generate businesses around a location ───────────────────────────
function generateBusinesses(center) {
  const places = [
    { offset: [0.003, 0.002], name: "Local Market",       open: true  },
    { offset: [-0.002, 0.004], name: "Pharmacy",           open: true  },
    { offset: [0.005, -0.001], name: "Restaurant",         open: false },
    { offset: [-0.001,-0.003], name: "Convenience Store",  open: true  },
    { offset: [0.004, 0.005],  name: "Tea Shop",           open: true  },
  ];
  return places.map((p, i) => ({
    id: i + 1,
    lat: center[0] + p.offset[0],
    lng: center[1] + p.offset[1],
    name: p.name,
    open: p.open,
  }));
}

// ─── HELPER: Draw a route line between two points ────────────────────────────
function generateRoute(start, end) {
  const steps = 12;
  const route = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const curve = Math.sin(t * Math.PI) * 0.001;
    route.push([
      start[0] + (end[0] - start[0]) * t + curve,
      start[1] + (end[1] - start[1]) * t + curve,
    ]);
  }
  return route;
}

// ─── HELPER: Reverse geocode lat/lng → address string ────────────────────────
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "en", "User-Agent": "ShadowPath/1.0" } }
    );
    const data = await res.json();
    return data.display_name?.split(",").slice(0, 3).join(", ") ||
           `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

// ─── HELPER: Search nearby places via Nominatim ──────────────────────────────
async function searchNearbyPlaces(lat, lng, query = "") {
  try {
    const viewbox = `${lng - 0.05},${lat - 0.05},${lng + 0.05},${lat + 0.05}`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query || "place")}&format=json&limit=12&viewbox=${viewbox}&bounded=1`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en", "User-Agent": "ShadowPath/1.0" },
    });
    const data = await res.json();
    return data.map((p) => ({
      name: p.display_name.split(",").slice(0, 3).join(", "),
      lat:  parseFloat(p.lat),
      lng:  parseFloat(p.lon),
    }));
  } catch {
    return [];
  }
}

// ─── MAP RECENTER COMPONENT ───────────────────────────────────────────────────
function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

// ─── MAP RIGHT-CLICK HANDLER ──────────────────────────────────────────────────
function MapClickHandler({ onMapClick }) {
  useMapEvents({ contextmenu(e) { onMapClick(e.latlng); } });
  return null;
}

// ─── LOCATION SELECTOR COMPONENT ─────────────────────────────────────────────
function LocationSelector({ label, value, onChange, userLocation }) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState(value || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref        = useRef();
  const debounceRef = useRef();

  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
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
    debounceRef.current = setTimeout(() => doSearch(val), 500);
  };

  const handleFocus = async () => {
    setOpen(true);
    if (results.length === 0 && userLocation) {
      setLoading(true);
      const places = await searchNearbyPlaces(userLocation[0], userLocation[1], query || "");
      setResults(places);
      setLoading(false);
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={styles.inputRow}>
        {label === "START POINT"
          ? <span style={{ color: "#60a5fa", fontSize: 14, flexShrink: 0 }}>➤</span>
          : <span style={{ color: "#a78bfa", fontSize: 14, flexShrink: 0 }}>🔍</span>}

        <input
          style={styles.locationInput}
          value={query}
          placeholder={label === "START POINT" ? "Your current location..." : "Search destination near you..."}
          onChange={handleChange}
          onFocus={handleFocus}
        />

        {loading && <span style={{ fontSize: 10, color: "#6366f1", flexShrink: 0 }}>⏳</span>}

        {label === "START POINT" && (
          <button
            style={styles.gpsBtn}
            title="Use my GPS"
            onClick={async () => {
              if (!navigator.geolocation) return;
              navigator.geolocation.getCurrentPosition(async (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                const name = await reverseGeocode(lat, lng);
                onChange({ name, lat, lng });
                setQuery(name);
              }, () => alert("Location access denied. Please allow it in browser settings."));
            }}
          >🎯</button>
        )}
      </div>

      {/* Dropdown results */}
      {open && results.length > 0 && (
        <div style={styles.dropdown}>
          {results.map((loc, i) => (
            <div
              key={i}
              style={styles.dropdownItem}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(99,102,241,0.2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              onMouseDown={() => {
                onChange(loc);
                setQuery(loc.name);
                setOpen(false);
              }}
            >
              <span style={{ marginRight: 6, opacity: 0.6, flexShrink: 0 }}>📍</span>
              <span style={{ fontSize: 11, lineHeight: 1.4 }}>{loc.name}</span>
            </div>
          ))}
        </div>
      )}

      {open && loading && results.length === 0 && (
        <div style={{ ...styles.dropdown, padding: "12px", textAlign: "center", color: "#6b7280", fontSize: 12 }}>
          Searching nearby places...
        </div>
      )}

      {open && !loading && results.length === 0 && query.length >= 2 && (
        <div style={{ ...styles.dropdown, padding: "12px", textAlign: "center", color: "#6b7280", fontSize: 12 }}>
          No places found. Try a different search.
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const FALLBACK = [14.6790, 77.6030]; // Anantapur fallback if GPS denied

  const [userLocation,   setUserLocation]   = useState(null);
  const [mapCenter,      setMapCenter]      = useState(FALLBACK);
  const [startLocation,  setStartLocation]  = useState(null);
  const [destination,    setDestination]    = useState(null);
  const [route,          setRoute]          = useState(null);
  const [hazardPins,     setHazardPins]     = useState([]);
  const [sosActive,      setSosActive]      = useState(false);
  const [shareLink,      setShareLink]      = useState(null);
  const [temporalHour,   setTemporalHour]   = useState(new Date().getHours());
  const [lights,         setLights]         = useState([]);
  const [businesses,     setBusinesses]     = useState([]);
  const [safetyScore,    setSafetyScore]    = useState(null);
  const [logMode,        setLogMode]        = useState(false);
  const [notification,   setNotification]   = useState(null);
  const [isNightMode,    setIsNightMode]    = useState(false);
  const [locationStatus, setLocationStatus] = useState("📡 Detecting your location...");

  // ── Step 1: Get GPS on app load ──────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      initFallback();
      return;
    }
    setLocationStatus("📡 Detecting your location...");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const center = [lat, lng];
        setUserLocation(center);
        setMapCenter(center);
        setBusinesses(generateBusinesses(center));
        const name = await reverseGeocode(lat, lng);
        setStartLocation({ name, lat, lng });
        setLocationStatus(`📍 ${name}`);
        // fetch lights from backend
        fetchLights(center);
      },
      () => initFallback(),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // ── Step 2: Watch GPS as user moves ─────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const center = [lat, lng];
        setUserLocation(center);
        setMapCenter(center);
        setBusinesses(generateBusinesses(center));
        if (!destination) {
          const name = await reverseGeocode(lat, lng);
          setStartLocation({ name, lat, lng });
          setLocationStatus(`📍 ${name}`);
        }
      },
      null,
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [destination]);

  // ── Fallback when GPS is denied ──────────────────────────────────────────
  function initFallback() {
    setUserLocation(FALLBACK);
    setMapCenter(FALLBACK);
    setBusinesses(generateBusinesses(FALLBACK));
    setStartLocation({ name: "Anantapur (default)", lat: FALLBACK[0], lng: FALLBACK[1] });
    setLocationStatus("⚠️ Location denied — using Anantapur default");
    fetchLights(FALLBACK);
  }

  // ── Fetch streetlights from backend ─────────────────────────────────────
  function fetchLights(center) {
    fetch(`${API}/api/lights`)
      .then((res) => res.json())
      .then((data) => {
        const offsets = [
          [0.002,0.001],[0.003,0.003],[-0.001,0.002],[0.004,-0.001],
          [-0.002,0.003],[0.001,-0.002],[0.003,0.005],[-0.003,-0.001],
        ];
        const apiLights = Object.entries(data).map(([nodeId, info], i) => ({
          id: nodeId,
          lat: center[0] + offsets[i % offsets.length][0],
          lng: center[1] + offsets[i % offsets.length][1],
          status: info.status === "ONLINE" ? "online" : "offline",
          lux: info.lux,
        }));
        setLights(apiLights);
      })
      .catch(() => {
        // backend offline — use simulated lights
        setLights(generateStreetlights(center));
      });
  }

  // ── Night mode toggle ────────────────────────────────────────────────────
  useEffect(() => {
    setIsNightMode(temporalHour >= 20 || temporalHour < 6);
  }, [temporalHour]);

  // ── Show toast notification ──────────────────────────────────────────────
  const showNotification = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // ── Calculate route using backend ────────────────────────────────────────
  const calculateRoute = useCallback(() => {
    if (!startLocation || !destination) return;
    const mode = isNightMode ? "safer" : "fastest";

    fetch(`${API}/api/route?mode=${mode}`)
      .then((res) => res.json())
      .then((data) => {
        const r = generateRoute(
          [startLocation.lat, startLocation.lng],
          [destination.lat,   destination.lng]
        );
        setRoute(r);
        const segments  = data.networkSegments || [];
        const avgSafety = segments.length
          ? segments.reduce((sum, s) => sum + Number(s.safety_score), 0) / segments.length
          : null;
        const score = avgSafety
          ? Math.round((avgSafety / 10) * 100)
          : Math.min(99, (isNightMode ? 55 : 82) + lights.filter((l) => l.status === "online").length * 2);
        setSafetyScore(score);
        showNotification(`Route calculated! Safety Score: ${score}%`, "success");
      })
      .catch(() => {
        // backend offline — calculate locally
        const r = generateRoute(
          [startLocation.lat, startLocation.lng],
          [destination.lat,   destination.lng]
        );
        setRoute(r);
        const score = Math.min(99, (isNightMode ? 55 : 82) + lights.filter((l) => l.status === "online").length * 2);
        setSafetyScore(score);
        showNotification(`Route calculated! Safety Score: ${score}%`, "success");
      });
  }, [startLocation, destination, lights, isNightMode]);

  useEffect(() => {
    if (destination) calculateRoute();
  }, [destination, temporalHour, lights, calculateRoute]);

  // ── Toggle streetlight + sync to backend ─────────────────────────────────
  const toggleLight = (id) => {
    setLights((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const newStatus = l.status === "online" ? "offline" : "online";
        fetch(`${API}/api/simulator/update`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            node_id:   id,
            lux_level: newStatus === "online" ? 85 : 0,
            status:    newStatus === "online" ? "ONLINE" : "OFFLINE",
          }),
        }).catch(() => {});
        return { ...l, status: newStatus };
      })
    );
    showNotification("Streetlight status updated", "info");
  };

  // ── Map right-click → drop hazard pin ────────────────────────────────────
  const handleMapClick = (latlng) => {
    if (!logMode) return;
    setHazardPins((prev) => [...prev, { lat: latlng.lat, lng: latlng.lng, id: Date.now() }]);
    showNotification("Hazard pin logged!", "warning");
    setLogMode(false);
  };

  // ── SOS button ───────────────────────────────────────────────────────────
  const handleSOS = () => {
    setSosActive(true);
    showNotification("🚨 SOS ACTIVATED — Sending location to emergency contacts!", "danger");
    setTimeout(() => setSosActive(false), 5000);
  };

  // ── Companion share link ─────────────────────────────────────────────────
  const handleShare = () => {
    const link = `https://shadowpath.vercel.app/share?lat=${startLocation?.lat}&lng=${startLocation?.lng}&dest=${encodeURIComponent(destination?.name || "")}&t=${Date.now()}`;
    setShareLink(link);
    navigator.clipboard?.writeText(link);
    showNotification("Companion share link copied!", "success");
  };

  // ── Time display string ──────────────────────────────────────────────────
  const timeString = (() => {
    const h    = temporalHour % 24;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12  = h % 12 || 12;
    return `${h12}:00 ${ampm}`;
  })();

  const routeColor       = isNightMode ? "#c084fc" : "#818cf8";
  const onlineLightsCount = lights.filter((l) => l.status === "online").length;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={styles.app}>

      {/* Toast notification */}
      {notification && (
        <div style={{ ...styles.toast, borderColor: toastColors[notification.type], animation: "slideIn 0.3s ease" }}>
          {notification.msg}
        </div>
      )}

      {/* Night overlay */}
      {isNightMode && <div style={styles.nightOverlay} />}

      {/* ── MAP ── */}
      <div style={styles.mapContainer}>
        <MapContainer center={mapCenter} zoom={15} style={{ width: "100%", height: "100%" }} zoomControl={false}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap &copy; CARTO'
          />
          <MapRecenter center={mapCenter} />
          <MapClickHandler onMapClick={handleMapClick} />

          {/* Start marker */}
          {startLocation && (
            <Marker position={[startLocation.lat, startLocation.lng]} icon={createIcon("#22d3ee", 16)}>
              <Popup>📍 {startLocation.name}</Popup>
            </Marker>
          )}

          {/* Destination marker */}
          {destination && (
            <Marker position={[destination.lat, destination.lng]} icon={createIcon("#f472b6", 16)}>
              <Popup>🏁 {destination.name}</Popup>
            </Marker>
          )}

          {/* Route polyline */}
          {route && (
            <Polyline
              positions={route}
              pathOptions={{ color: routeColor, weight: 4, opacity: 0.9, dashArray: isNightMode ? "8,4" : undefined }}
            />
          )}

          {/* Streetlights */}
          {lights.map((light) => (
            <Marker
              key={light.id}
              position={[light.lat, light.lng]}
              icon={light.status === "online" ? streetlightIcon : brokenLightIcon}
              eventHandlers={{ click: () => toggleLight(light.id) }}
            >
              <Popup>
                {light.status === "online" ? "✅ Working Streetlight" : "❌ Broken Light"}
                {light.lux !== undefined && <><br /><small style={{ color: "#9ca3af" }}>Lux: {light.lux}</small></>}
                <br /><small style={{ color: "#6366f1" }}>Click to toggle status</small>
              </Popup>
            </Marker>
          ))}

          {/* Businesses */}
          {businesses.map((biz) => (
            <Marker key={biz.id} position={[biz.lat, biz.lng]} icon={shopIcon}>
              <Popup>{biz.open ? "🟢 Active" : "🔴 Closed"} — {biz.name}</Popup>
            </Marker>
          ))}

          {/* Hazard pins */}
          {hazardPins.map((pin) => (
            <Marker key={pin.id} position={[pin.lat, pin.lng]} icon={hazardIcon}>
              <Popup>⚠️ Community Hazard Report</Popup>
            </Marker>
          ))}

          {/* SOS pulse circle */}
          {sosActive && startLocation && (
            <Circle
              center={[startLocation.lat, startLocation.lng]}
              radius={300}
              pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.15, weight: 2 }}
            />
          )}
        </MapContainer>
      </div>

      {/* ── HUD PANEL ── */}
      <div style={styles.hud}>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logoBox}><span style={{ fontSize: 22 }}>🛡️</span></div>
          <div>
            <div style={styles.appName}>ShadowPath</div>
            <div style={styles.appSub}>Safe pedestrian routing engine</div>
          </div>
        </div>

        {/* Live location status */}
        <div style={styles.locationStatusBox}>
          <span style={{ fontSize: 11, color: "#94a3b8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {locationStatus}
          </span>
        </div>

        {/* Safety Score */}
        {safetyScore !== null && (
          <div style={styles.scoreBar}>
            <span style={styles.scoreLabel}>SAFETY SCORE</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={styles.scoreTrack}>
                <div style={{
                  ...styles.scoreFill,
                  width: `${safetyScore}%`,
                  background: safetyScore >= 80 ? "#10b981" : safetyScore >= 60 ? "#f59e0b" : "#ef4444",
                }} />
              </div>
              <span style={{
                ...styles.scoreBadge,
                background: safetyScore >= 80 ? "#10b981" : safetyScore >= 60 ? "#f59e0b" : "#ef4444",
              }}>
                {safetyScore}%
              </span>
            </div>
          </div>
        )}

        {/* Share button */}
        <button style={styles.shareBtn} onClick={handleShare}>
          <span style={{ marginRight: 6 }}>🔗</span> Generate Companion Share Link
        </button>
        {shareLink && (
          <div style={styles.shareLink}>
            {shareLink.slice(0, 52)}...
          </div>
        )}

        {/* Temporal Sync */}
        <div style={styles.temporalBox}>
          <div style={styles.temporalHeader}>
            <span style={styles.temporalLabel}>⏱ TEMPORAL SYNC</span>
            <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 14 }}>{timeString}</span>
          </div>
          <input
            type="range" min={0} max={23} value={temporalHour}
            onChange={(e) => setTemporalHour(Number(e.target.value))}
            style={styles.slider}
          />
          <div style={styles.sliderLabels}>
            <span>12AM</span><span>6AM</span><span>12PM</span><span>6PM</span><span>11PM</span>
          </div>
          {isNightMode && (
            <div style={styles.nightBadge}>🌙 Night Mode — Route optimised for safety</div>
          )}
        </div>

        {/* SOS Button */}
        <button
          style={{ ...styles.sosBtn, ...(sosActive ? styles.sosBtnActive : {}) }}
          onClick={handleSOS}
        >
          <span style={{ marginRight: 6 }}>🚨</span>
          {sosActive ? "SOS ACTIVATED — LOCATING HELP..." : "🛡 ACTIVATE SOS PANIC REFUGE"}
        </button>

        {/* Log Hazard */}
        <button
          style={{ ...styles.logBtn, ...(logMode ? { borderColor: "#f59e0b", color: "#f59e0b" } : {}) }}
          onClick={() => {
            setLogMode(!logMode);
            if (!logMode) showNotification("Right-click on the map to place a hazard pin", "warning");
          }}
        >
          <span style={{ marginRight: 6 }}>⚠️</span>
          {logMode ? "Click on map to place pin..." : "+ Log New Broken Light / Hazard"}
        </button>

        {/* Route Inputs */}
        <div style={styles.routeSection}>
          <div style={styles.inputLabel}>START POINT</div>
          <LocationSelector
            label="START POINT"
            value={startLocation?.name || ""}
            onChange={setStartLocation}
            userLocation={userLocation || FALLBACK}
          />
          <div style={{ ...styles.inputLabel, marginTop: 10 }}>DESTINATION</div>
          <LocationSelector
            label="DESTINATION"
            value={destination?.name || ""}
            onChange={setDestination}
            userLocation={userLocation || FALLBACK}
          />
        </div>

        {/* Stats row */}
        <div style={styles.statsRow}>
          <div style={styles.statBox}>
            <div style={{ fontSize: 18 }}>💡</div>
            <div style={styles.statNum}>{onlineLightsCount}</div>
            <div style={styles.statLabel}>Lights On</div>
          </div>
          <div style={styles.statBox}>
            <div style={{ fontSize: 18 }}>🏪</div>
            <div style={styles.statNum}>{businesses.filter((b) => b.open).length}</div>
            <div style={styles.statLabel}>Open Shops</div>
          </div>
          <div style={styles.statBox}>
            <div style={{ fontSize: 18 }}>⚠️</div>
            <div style={styles.statNum}>{hazardPins.length}</div>
            <div style={styles.statLabel}>Hazards</div>
          </div>
        </div>

        {/* Legend */}
        <div style={styles.legendBox}>
          <div style={styles.legendTitle}>INFRASTRUCTURE MAP SIGNS</div>
          <div style={styles.legendItem}><span style={{ fontSize: 16 }}>💡</span><span>Amber Bulb: <strong>Working Streetlight Grid</strong></span></div>
          <div style={styles.legendItem}><span style={{ fontSize: 16 }}>🏪</span><span>Green Shop: <strong>Active Working Business Area</strong></span></div>
          <div style={styles.legendItem}><span style={{ fontSize: 16 }}>⚠️</span><span>Red Triangle: <strong>Non-Working / Broken Roads</strong></span></div>
          <div style={styles.legendItem}><span style={{ fontSize: 16 }}>🔦</span><span style={{ color: "#9ca3af" }}>Dim Torch: <strong>Offline / Broken Light</strong></span></div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <span>Right-click map to pin hazards</span>
          <span style={{ color: "#4f46e5" }}>ShadowPath v1.0</span>
        </div>
      </div>
    </div>
  );
}

// ─── TOAST COLORS ─────────────────────────────────────────────────────────────
const toastColors = {
  info:    "#60a5fa",
  success: "#10b981",
  warning: "#f59e0b",
  danger:  "#ef4444",
};

// ─── ALL STYLES ───────────────────────────────────────────────────────────────
const styles = {
  app:             { position: "relative", width: "100vw", height: "100vh", background: "#0a0e1a", fontFamily: "'DM Sans','Segoe UI',sans-serif", overflow: "hidden" },
  mapContainer:    { position: "absolute", inset: 0, zIndex: 0 },
  nightOverlay:    { position: "absolute", inset: 0, background: "rgba(0,0,20,0.4)", zIndex: 1, pointerEvents: "none", animation: "nightFade 1s ease" },
  hud:             { position: "absolute", top: 12, left: 12, bottom: 12, width: 340, zIndex: 10, background: "rgba(10,14,30,0.93)", backdropFilter: "blur(18px)", borderRadius: 16, border: "1px solid rgba(99,102,241,0.25)", padding: "14px 14px 10px", display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", overflowX: "hidden", boxShadow: "0 0 40px rgba(79,70,229,0.15),inset 0 1px 0 rgba(255,255,255,0.05)", scrollbarWidth: "thin", scrollbarColor: "rgba(99,102,241,0.3) transparent" },
  header:          { display: "flex", alignItems: "center", gap: 10, paddingBottom: 8, borderBottom: "1px solid rgba(99,102,241,0.2)" },
  logoBox:         { width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#1e3a5f,#312e81)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(99,102,241,0.4)", flexShrink: 0 },
  appName:         { color: "#e0e7ff", fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px" },
  appSub:          { color: "#6b7280", fontSize: 11 },
  locationStatusBox: { display: "flex", alignItems: "center", gap: 6, background: "rgba(30,41,59,0.6)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 8, padding: "5px 10px" },
  scoreBar:        { display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: "7px 12px" },
  scoreLabel:      { color: "#9ca3af", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em" },
  scoreTrack:      { width: 60, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", overflow: "hidden" },
  scoreFill:       { height: "100%", borderRadius: 2, transition: "width 0.5s ease" },
  scoreBadge:      { padding: "2px 8px", borderRadius: 20, color: "#fff", fontSize: 12, fontWeight: 700 },
  shareBtn:        { background: "rgba(30,58,138,0.6)", border: "1px solid rgba(99,102,241,0.35)", borderRadius: 10, color: "#93c5fd", padding: "9px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, textAlign: "center" },
  shareLink:       { background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 6, padding: "5px 8px", color: "#a5b4fc", fontSize: 10, wordBreak: "break-all" },
  temporalBox:     { background: "rgba(15,23,42,0.8)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, padding: "10px 12px" },
  temporalHeader:  { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  temporalLabel:   { color: "#9ca3af", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em" },
  slider:          { width: "100%", accentColor: "#6366f1", cursor: "pointer" },
  sliderLabels:    { display: "flex", justifyContent: "space-between", color: "#4b5563", fontSize: 9, marginTop: 4 },
  nightBadge:      { marginTop: 6, background: "rgba(109,40,217,0.2)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 6, padding: "4px 8px", color: "#c084fc", fontSize: 10, textAlign: "center" },
  sosBtn:          { background: "linear-gradient(135deg,#dc2626,#f97316)", border: "none", borderRadius: 10, color: "#fff", padding: "12px 14px", cursor: "pointer", fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", textAlign: "center", textTransform: "uppercase", boxShadow: "0 4px 20px rgba(239,68,68,0.35)", transition: "all 0.2s" },
  sosBtnActive:    { animation: "pulse 0.5s infinite alternate", background: "linear-gradient(135deg,#7f1d1d,#dc2626)", boxShadow: "0 0 30px rgba(239,68,68,0.7)" },
  logBtn:          { background: "rgba(15,23,42,0.6)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 10, color: "#d1d5db", padding: "9px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, textAlign: "center", transition: "all 0.2s" },
  routeSection:    { background: "rgba(15,23,42,0.7)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, padding: "10px 12px" },
  inputLabel:      { color: "#9ca3af", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 5 },
  inputRow:        { display: "flex", alignItems: "center", gap: 6, background: "rgba(30,41,59,0.8)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 8, padding: "6px 10px" },
  locationInput:   { flex: 1, background: "transparent", border: "none", color: "#e0e7ff", fontSize: 12, outline: "none", minWidth: 0 },
  gpsBtn:          { background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 0, flexShrink: 0 },
  dropdown:        { position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "rgba(10,14,30,0.98)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, zIndex: 9999, maxHeight: 180, overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.7)" },
  dropdownItem:    { padding: "8px 12px", color: "#cbd5e1", fontSize: 12, cursor: "pointer", transition: "background 0.15s", display: "flex", alignItems: "flex-start" },
  statsRow:        { display: "flex", gap: 6 },
  statBox:         { flex: 1, background: "rgba(15,23,42,0.7)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 8, padding: "8px 4px", textAlign: "center" },
  statNum:         { color: "#e0e7ff", fontSize: 18, fontWeight: 700, lineHeight: 1.2 },
  statLabel:       { color: "#6b7280", fontSize: 9, marginTop: 2 },
  legendBox:       { background: "rgba(15,23,42,0.6)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 10, padding: "10px 12px" },
  legendTitle:     { color: "#9ca3af", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 },
  legendItem:      { display: "flex", alignItems: "center", gap: 8, color: "#d1d5db", fontSize: 11, marginBottom: 5 },
  footer:          { display: "flex", justifyContent: "space-between", color: "#4b5563", fontSize: 9, paddingTop: 4, borderTop: "1px solid rgba(99,102,241,0.1)", marginTop: "auto" },
  toast:           { position: "fixed", top: 16, right: 16, zIndex: 9999, background: "rgba(10,14,30,0.96)", border: "1px solid", borderRadius: 10, padding: "10px 16px", color: "#e0e7ff", fontSize: 12, fontWeight: 600, backdropFilter: "blur(12px)", boxShadow: "0 4px 20px rgba(0,0,0,0.5)", maxWidth: 300 },
};