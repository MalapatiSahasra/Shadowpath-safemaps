import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowUp, Flag, MapPin, RotateCw, Volume2, VolumeX, LocateFixed, Mic, MicOff } from "lucide-react";

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

// Directional arrow marker for live navigation, rotated to match GPS heading
const createHeadingIcon = (angle = 0) =>
  L.divIcon({
    className: "",
    html: `<div style="width:34px;height:34px;display:flex;align-items:center;justify-content:center;transform:rotate(${angle}deg);filter:drop-shadow(0 0 6px #3b82f6)">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="#3b82f6" stroke="#fff" stroke-width="1.5"><path d="M12 2 L19 21 L12 17 L5 21 Z"/></svg>
    </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

const streetlightIcon = L.divIcon({ className: "", html: `<div style="font-size:18px;filter:drop-shadow(0 0 4px #f59e0b)">💡</div>`, iconSize: [20, 20], iconAnchor: [10, 10] });
const brokenLightIcon = L.divIcon({ className: "", html: `<div style="font-size:18px;opacity:0.5">🔦</div>`, iconSize: [20, 20], iconAnchor: [10, 10] });
const shopIcon = L.divIcon({ className: "", html: `<div style="font-size:16px;filter:drop-shadow(0 0 4px #10b981)">🏪</div>`, iconSize: [20, 20], iconAnchor: [10, 10] });
const closedShopIcon = L.divIcon({ className: "", html: `<div style="font-size:16px;opacity:0.35;filter:grayscale(1)">🏪</div>`, iconSize: [20, 20], iconAnchor: [10, 10] });
const hazardIcon = L.divIcon({ className: "", html: `<div style="font-size:16px">⚠️</div>`, iconSize: [20, 20], iconAnchor: [10, 10] });
const emergencyRefugeIcon = L.divIcon({ className: "", html: `<div style="font-size:18px;filter:drop-shadow(0 0 6px #ef4444)">🚓</div>`, iconSize: [22, 22], iconAnchor: [11, 11] });

function generateStreetlights(center) {
  const offsets = [[0.0042, 0.0038], [0.0092, 0.0089], [-0.0036, 0.0074], [0.0121, -0.0025], [-0.0064, 0.0120], [0.0037, -0.0062], [0.0081, 0.0158], [-0.0079, -0.0036], [0.0168, 0.0062], [-0.0026, 0.0131]];
  return offsets.map((o, i) => ({ id: i + 1, lat: center[0] + o[0], lng: center[1] + o[1], status: i % 3 === 2 ? "offline" : "online" }));
}

function generateBusinesses(center) {
  const places = [{ offset: [0.0058, 0.0042], name: "Local Market Square", open: true }, { offset: [-0.0040, 0.0098], name: "Emergency Pharmacy 24/7", open: true }, { offset: [0.0145, -0.0013], name: "Central Food Court", open: false }, { offset: [-0.0013, -0.0069], name: "Convenience Store Hub", open: true }];
  return places.map((p, i) => ({ id: i + 1, lat: center[0] + p.offset[0], lng: center[1] + p.offset[1], name: p.name, open: p.open }));
}

// Picks evenly-spaced points along a route's coordinates, with a small jitter so the
// point sits just off the road — used to seed streetlights/businesses that a route can
// actually pass near, instead of scattering them around an unrelated geometric midpoint.
function sampleAlongRoute(routeCoords, count, jitterDeg) {
  if (!routeCoords || routeCoords.length === 0) return [];
  const pts = [];
  const step = Math.max(1, Math.floor(routeCoords.length / count));
  for (let i = 0; i < routeCoords.length && pts.length < count; i += step) {
    const [lat, lng] = routeCoords[i];
    pts.push([lat + (Math.random() - 0.5) * 2 * jitterDeg, lng + (Math.random() - 0.5) * 2 * jitterDeg]);
  }
  return pts;
}

// Streetlights/businesses actually distributed along the route(s) being scored, so
// coverage — and the green/yellow segment coloring — reflects the real path.
function generateStreetlightsAlongRoute(routeCoords) {
  const points = sampleAlongRoute(routeCoords, 16, 0.0006);
  return points.map((p, i) => ({ id: i + 1, lat: p[0], lng: p[1], status: i % 3 === 2 ? "offline" : "online" }));
}

function generateBusinessesAlongRoute(routeCoords) {
  const names = ["Local Market Square", "Emergency Pharmacy 24/7", "Central Food Court", "Convenience Store Hub", "Night Owl Cafe", "Corner Grocery"];
  const points = sampleAlongRoute(routeCoords, 6, 0.0006);
  return points.map((p, i) => ({ id: i + 1, lat: p[0], lng: p[1], name: names[i % names.length], open: i % 4 !== 2 }));
}

function generateRefugeHubs(center) {
  return [{ id: 101, name: "City Core Police Station", lat: center[0] + 0.0042, lng: center[1] - 0.0125, type: "Police Station" }, { id: 102, name: "District General Hospital", lat: center[0] - 0.0098, lng: center[1] + 0.0079, type: "Hospital" }];
}

// ---- Geometry helpers for live tracking (distance, bearing, route projection) ----
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

function haversineMeters(a, b) {
  const R = 6371000;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function computeBearing(a, b) {
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const dLng = toRad(b[1] - a[1]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Approximates the nearest point on the route polyline to a live GPS fix
function nearestPointOnRoute(route, point) {
  let bestIndex = 0;
  let bestDist = Infinity;
  for (let i = 0; i < route.length; i++) {
    const d = haversineMeters(route[i], point);
    if (d < bestDist) { bestDist = d; bestIndex = i; }
  }
  return { index: bestIndex, distance: bestDist };
}

// Radii used to judge whether a stretch of route is "covered" by safety infrastructure
const LIGHT_COVERAGE_RADIUS_M = 150;
const BUSINESS_COVERAGE_RADIUS_M = 120;

function isPointCovered(point, lights, businesses) {
  const nearLight = lights.some((l) => l.status === "online" && haversineMeters(point, [l.lat, l.lng]) <= LIGHT_COVERAGE_RADIUS_M);
  if (nearLight) return true;
  return businesses.some((b) => b.open && haversineMeters(point, [b.lat, b.lng]) <= BUSINESS_COVERAGE_RADIUS_M);
}

// Fraction of a route's length that falls within streetlight/business coverage — the
// actual basis for calling one alternative "safer" than another, rather than a guess.
function scoreRouteCoverage(routeCoords, lights, businesses) {
  if (!routeCoords || routeCoords.length === 0) return 0;
  const step = Math.max(1, Math.floor(routeCoords.length / 60));
  let covered = 0;
  let total = 0;
  for (let i = 0; i < routeCoords.length; i += step) {
    total++;
    if (isPointCovered(routeCoords[i], lights, businesses)) covered++;
  }
  return total > 0 ? covered / total : 0;
}

// Splits a route polyline into contiguous covered/uncovered runs so the map can render
// which stretches are actually lit or near active businesses versus dark shortcuts.
function buildCoverageSegments(routeCoords, lights, businesses) {
  if (!routeCoords || routeCoords.length < 2) return [];
  const flags = routeCoords.map((pt) => isPointCovered(pt, lights, businesses));
  const segments = [];
  let start = 0;
  for (let i = 1; i < routeCoords.length; i++) {
    if (flags[i] !== flags[start]) {
      segments.push({ coords: routeCoords.slice(start, i + 1), covered: flags[start] });
      start = i;
    }
  }
  segments.push({ coords: routeCoords.slice(start), covered: flags[start] });
  return segments;
}

function formatDistance(meters) {
  if (!Number.isFinite(meters)) return "--";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "--";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

// Formats raw OSRM maneuver data into human-readable directions
function formatInstruction(step) {
  const type = step.maneuver?.type;
  const modifier = step.maneuver?.modifier;
  const name = step.name ? step.name : "unnamed road";
  const dist = Math.round(step.distance);

  if (type === 'depart') return `Start your journey on ${name}`;
  if (type === 'arrive') return `You will arrive at your destination`;

  let action = "Head";
  if (type === 'turn') action = "Turn";
  if (type === 'roundabout') action = "Enter the roundabout and exit onto";
  if (type === 'merge') action = "Merge onto";
  if (type === 'fork') action = "Keep";

  const dir = modifier ? ` ${modifier.replace('-', ' ')}` : "";
  return `${action}${dir} onto ${name} (${dist}m)`;
}

// Maps an OSRM maneuver to a turn-banner icon + rotation angle
const MODIFIER_ANGLES = {
  straight: 0, "slight right": 30, right: 90, "sharp right": 135,
  uturn: 180, "sharp left": -135, left: -90, "slight left": -30,
};

function getManeuverVisual(step) {
  const type = step?.type;
  const modifier = step?.modifier;
  if (type === "depart") return { Icon: Flag, angle: 0 };
  if (type === "arrive") return { Icon: MapPin, angle: 0 };
  if (type === "roundabout" || type === "rotary" || type === "roundabout turn") return { Icon: RotateCw, angle: 0 };
  return { Icon: ArrowUp, angle: MODIFIER_ANGLES[modifier] ?? 0 };
}

// Converts a raw OSRM route object into the shape the app renders/scores
function toRouteResult(route) {
  const pathCoords = route.geometry.coordinates.map((c) => [c[1], c[0]]);

  // Parse steps for the directions HUD and live turn-by-turn banner
  const steps = route.legs && route.legs[0]?.steps
    ? route.legs[0].steps.map((s) => ({
        text: formatInstruction(s),
        distance: s.distance,
        duration: s.duration,
        type: s.maneuver?.type,
        modifier: s.maneuver?.modifier,
        location: s.maneuver?.location ? [s.maneuver.location[1], s.maneuver.location[0]] : null,
      }))
    : [];

  return {
    coords: pathCoords,
    distanceText: `${(route.distance / 1000).toFixed(2)} km`,
    rawMeters: route.distance,
    steps: steps
  };
}

// BULLETPROOF 3-TIER OSRM ENGINE WITH DIRECTIONS
async function fetchOSRMRoute(startPt, endPt, alternativeMode = false) {
  const baseUrl = "https://router.project-osrm.org/route/v1";
  const coords = `${startPt[1]},${startPt[0]};${endPt[1]},${endPt[0]}`;
  // steps=true is added to fetch turn-by-turn instructions
  const queryParams = `overview=full&geometries=geojson&steps=true&alternatives=${alternativeMode}`;

  try {
    let res = await fetch(`${baseUrl}/foot/${coords}?${queryParams}`);
    let data = await res.json();

    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      console.warn("Foot routing failed. Trying driving profile...");
      res = await fetch(`${baseUrl}/driving/${coords}?${queryParams}`);
      data = await res.json();
    }

    if (alternativeMode && (data.code !== "Ok" || !data.routes || data.routes.length === 0)) {
      console.warn("Alternatives failed. Trying forced direct route...");
      res = await fetch(`${baseUrl}/driving/${coords}?overview=full&geometries=geojson&steps=true&alternatives=false`);
      data = await res.json();
    }

    if (data.code === "Ok" && data.routes && data.routes.length > 0) {
      const selectedRoute = alternativeMode && data.routes.length > 1 ? data.routes[1] : data.routes[0];
      return toRouteResult(selectedRoute);
    }
  } catch (e) {
    console.error("OSRM Fetch Error: ", e);
  }
  return null;
}

// Fetches every route alternative OSRM offers (rather than picking one blindly) so the
// caller can score each by streetlight/business coverage and choose the genuinely safer one
async function fetchOSRMRouteOptions(startPt, endPt) {
  const baseUrl = "https://router.project-osrm.org/route/v1";
  const coords = `${startPt[1]},${startPt[0]};${endPt[1]},${endPt[0]}`;
  const queryParams = `overview=full&geometries=geojson&steps=true&alternatives=true`;

  try {
    let res = await fetch(`${baseUrl}/foot/${coords}?${queryParams}`);
    let data = await res.json();

    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      console.warn("Foot routing failed. Trying driving profile...");
      res = await fetch(`${baseUrl}/driving/${coords}?${queryParams}`);
      data = await res.json();
    }

    if (data.code === "Ok" && data.routes && data.routes.length > 0) {
      return data.routes.map(toRouteResult);
    }
  } catch (e) {
    console.error("OSRM Fetch Error: ", e);
  }
  return [];
}

function MapRecenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, zoom ?? map.getZoom()); }, [center, zoom, map]);
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

// Drops out of camera-follow mode the moment the user manually drags the map
function FollowModeHandler({ active, onUserDrag }) {
  useMapEvents({ dragstart() { if (active) onUserDrag(); } });
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
  const [listening, setListening] = useState(false);
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

  // Voice search: speak a place name instead of typing it
  const voiceSupported = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const startVoiceSearch = () => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor || listening) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript || "";
      if (transcript) {
        setQuery(transcript);
        setOpen(true);
        doSearch(transcript);
      }
    };
    recognition.start();
  };

  return (
    <div ref={ref} style={{ position: "relative", zIndex: label === "DESTINATION" ? 10000 : 5000 }}>
      <div style={{ ...styles.inputRow, ...(label === "START POINT" && gpsDetecting ? { border: "1px solid rgba(34,211,238,0.5)" } : {}) }}>
        {label === "START POINT" ? (
          gpsDetecting ? ( <span className="gps-detecting" style={{ width: 10, height: 10, borderRadius: "50%", background: "#22d3ee", flexShrink: 0 }} /> ) : ( <span style={{ color: "#60a5fa", fontSize: 14 }}>➤</span> )
        ) : ( <span style={{ color: "#a78bfa", fontSize: 14 }}>🔍</span> )}
        <input
          style={styles.locationInput}
          value={query}
          placeholder={label === "START POINT" ? "Detecting location..." : listening ? "Listening..." : "Search destination..."}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
        />
        {loading && <span style={{ fontSize: 10, color: "#6366f1" }}>⏳</span>}
        {voiceSupported && (
          <button type="button" onClick={startVoiceSearch} title="Search by voice" style={{ ...styles.micBtn, ...(listening ? styles.micBtnActive : {}) }}>
            {listening ? <MicOff size={13} /> : <Mic size={13} />}
          </button>
        )}
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

// Live navigation tuning constants
const ARRIVAL_THRESHOLD_M = 15;
const STEP_ADVANCE_THRESHOLD_M = 25;
const OFF_ROUTE_THRESHOLD_M = 40;
const REROUTE_COOLDOWN_MS = 15000;
const NAV_ZOOM = 17;

export default function App() {
  const FALLBACK_CENTER = [9.9312, 76.2673];

  const [userLocation, setUserLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState(FALLBACK_CENTER);
  const [startLocation, setStartLocation] = useState(null);
  const [destination, setDestination] = useState(null);

  const [safestRoute, setSafestRoute] = useState(null);
  const [dangerRoute, setDangerRoute] = useState(null);

  const [directions, setDirections] = useState([]);
  const [showDirections, setShowDirections] = useState(false);

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

  const [routeMetrics, setRouteMetrics] = useState({ standardDist: "0.0 km", shadowDist: "0.0 km", distanceTradeoff: "0m", coveragePct: 0 });

  const [isNavigating, setIsNavigating] = useState(false);
  const [livePosition, setLivePosition] = useState(null);

  // Live turn-by-turn navigation state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [followMode, setFollowMode] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [heading, setHeading] = useState(0);
  const [isRerouting, setIsRerouting] = useState(false);

  const prevLivePositionRef = useRef(null);
  const lastAnnouncedIndexRef = useRef(-1);
  const lastRerouteAtRef = useRef(0);

  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTemporalHour(now.getHours());
      setTemporalMinute(now.getMinutes());
      setNowMs(now.getTime());
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { setIsNightMode(temporalHour >= 19 || temporalHour < 6); }, [temporalHour]);

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

  // GPS watch: tracks live position and derives a heading (device compass, else bearing of travel)
  useEffect(() => {
    let watchId;
    if (isNavigating && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const next = [pos.coords.latitude, pos.coords.longitude];
          setHeading((prevHeading) => {
            if (typeof pos.coords.heading === "number" && !Number.isNaN(pos.coords.heading) && pos.coords.speed > 0.3) {
              return pos.coords.heading;
            }
            if (prevLivePositionRef.current) {
              const d = haversineMeters(prevLivePositionRef.current, next);
              if (d > 2) return computeBearing(prevLivePositionRef.current, next);
            }
            return prevHeading;
          });
          prevLivePositionRef.current = next;
          setLivePosition(next);
        },
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
    setTimeout(() => setNotification(null), 5000);
  };

  const speak = useCallback((text) => {
    if (!voiceEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }, [voiceEnabled]);

  const calculateSafetyRoutes = useCallback(async () => {
    if (!startLocation || !destination) return;
    const startPt = [startLocation.lat, startLocation.lng];
    const endPt = [destination.lat, destination.lng];
    const midPoint = [(startPt[0] + endPt[0]) / 2, (startPt[1] + endPt[1]) / 2];
    setRefugeHubs(generateRefugeHubs(midPoint));

    const routeOptions = await fetchOSRMRouteOptions(startPt, endPt);

    if (routeOptions.length === 0) {
      showNotification("🚨 Routing Error: The server could not find a physical road connecting these points. Try locations closer together.", "danger");
      setSafestRoute(null);
      setDangerRoute(null);
      setDirections([]);
      return;
    }

    // Seed streetlights/businesses along the actual candidate route geometry (not a
    // fixed offset from the midpoint) so coverage — and the green segments — reflect
    // roads a route could realistically pass, and both alternatives get a fair shot.
    const combinedCoords = routeOptions.flatMap((r) => r.coords);
    const routeLights = generateStreetlightsAlongRoute(combinedCoords);
    const routeBusinesses = generateBusinessesAlongRoute(combinedCoords);
    setLights(routeLights);
    setBusinesses(routeBusinesses);

    // Score every alternative by how much of it runs near lit streetlights / open
    // businesses, then pick the best-covered one as the "safest" route — not a guess.
    const scored = routeOptions
      .map((r) => ({ ...r, coverage: scoreRouteCoverage(r.coords, routeLights, routeBusinesses) }))
      .sort((a, b) => b.coverage - a.coverage || a.rawMeters - b.rawMeters);

    const safest = scored[0];
    const riskiest = scored.length > 1 ? scored[scored.length - 1] : null;

    setSafestRoute(safest.coords);
    setDirections(safest.steps);
    setDangerRoute(riskiest ? riskiest.coords : null);

    const diffMeters = riskiest ? Math.max(0, Math.round(safest.rawMeters - riskiest.rawMeters)) : 0;
    const coveragePct = Math.round(safest.coverage * 100);

    setRouteMetrics({
      standardDist: riskiest ? riskiest.distanceText : safest.distanceText,
      shadowDist: safest.distanceText,
      distanceTradeoff: `+${diffMeters} meters`,
      coveragePct
    });

    // Night hours weight lit/business coverage more heavily since natural visibility is gone
    const baseline = isNightMode ? 55 : 75;
    const bonus = isNightMode ? 40 : 20;
    setSafetyScore(Math.round(baseline + safest.coverage * bonus));
  }, [startLocation, destination, isNightMode]);

  useEffect(() => { if (destination) calculateSafetyRoutes(); }, [destination, calculateSafetyRoutes]);

  // Re-plans the route from a live GPS fix when the walker has drifted off the path,
  // re-scoring alternatives against the same streetlight/business coverage data.
  const rerouteFromLivePosition = useCallback(async (fromPoint) => {
    if (!destination) return;
    setIsRerouting(true);
    showNotification("📡 Off route detected — recalculating path...", "warning");
    const endPt = [destination.lat, destination.lng];
    const routeOptions = await fetchOSRMRouteOptions(fromPoint, endPt);

    if (routeOptions.length > 0) {
      const scored = routeOptions
        .map((r) => ({ ...r, coverage: scoreRouteCoverage(r.coords, lights, businesses) }))
        .sort((a, b) => b.coverage - a.coverage || a.rawMeters - b.rawMeters);
      const safest = scored[0];
      const riskiest = scored.length > 1 ? scored[scored.length - 1] : null;

      setDangerRoute(riskiest ? riskiest.coords : null);
      setSafestRoute(safest.coords);
      setDirections(safest.steps);
      setCurrentStepIndex(0);
      lastAnnouncedIndexRef.current = -1;
      showNotification("✅ Route recalculated.", "success");
    }
    setIsRerouting(false);
  }, [destination, lights, businesses]);

  // Derived live stats: distance to next turn, remaining distance/time — recomputed
  // from the latest GPS fix rather than stored, so no state sync is needed on every tick.
  const navStats = useMemo(() => {
    const empty = { distanceToNext: 0, remainingDistance: 0, remainingDuration: 0 };
    if (!isNavigating || !livePosition || directions.length === 0) return empty;
    const step = directions[currentStepIndex];
    if (!step?.location) return empty;

    const distToManeuver = haversineMeters(livePosition, step.location);
    const isLastStep = currentStepIndex === directions.length - 1;
    if (isLastStep) {
      return { distanceToNext: distToManeuver, remainingDistance: distToManeuver, remainingDuration: step.duration || 0 };
    }

    const remainingSteps = directions.slice(currentStepIndex + 1);
    const remainingDistance = distToManeuver + remainingSteps.reduce((sum, s) => sum + (s.distance || 0), 0);
    const remainingDuration = (distToManeuver / Math.max(step.distance || 1, 1)) * (step.duration || 0)
      + remainingSteps.reduce((sum, s) => sum + (s.duration || 0), 0);
    return { distanceToNext: distToManeuver, remainingDistance, remainingDuration };
  }, [isNavigating, livePosition, directions, currentStepIndex]);

  // Drives the Google-Maps-style banner: advances steps, follows the camera,
  // detects off-route drift, and announces arrival — all in reaction to fresh GPS fixes.
  useEffect(() => {
    if (!isNavigating || !livePosition || directions.length === 0) return;

    const step = directions[currentStepIndex];
    if (step?.location) {
      const distToManeuver = haversineMeters(livePosition, step.location);
      const isLastStep = currentStepIndex === directions.length - 1;

      if (isLastStep) {
        if (distToManeuver < ARRIVAL_THRESHOLD_M) {
          showNotification("🎉 You have arrived at your destination!", "success");
          speak("You have arrived at your destination.");
          setIsNavigating(false);
        }
      } else {
        const advanceThreshold = currentStepIndex === 0 ? 15 : STEP_ADVANCE_THRESHOLD_M;
        if (distToManeuver < advanceThreshold) {
          setCurrentStepIndex((i) => Math.min(i + 1, directions.length - 1));
        }
      }
    }

    if (safestRoute && safestRoute.length > 1) {
      const { distance: offRouteDist } = nearestPointOnRoute(safestRoute, livePosition);
      const now = Date.now();
      if (offRouteDist > OFF_ROUTE_THRESHOLD_M && now - lastRerouteAtRef.current > REROUTE_COOLDOWN_MS) {
        lastRerouteAtRef.current = now;
        rerouteFromLivePosition(livePosition);
      }
    }

    if (followMode) setMapCenter(livePosition);
  }, [livePosition, isNavigating, directions, currentStepIndex, safestRoute, followMode, speak, rerouteFromLivePosition]);

  // Speaks each new turn instruction exactly once, as it becomes current
  useEffect(() => {
    if (!isNavigating || directions.length === 0) return;
    if (lastAnnouncedIndexRef.current === currentStepIndex) return;
    lastAnnouncedIndexRef.current = currentStepIndex;
    const step = directions[currentStepIndex];
    if (step) speak(step.text);
  }, [currentStepIndex, isNavigating, directions, speak]);

  const routeProgress = useMemo(() => {
    if (!safestRoute || !isNavigating || !livePosition) return null;
    return nearestPointOnRoute(safestRoute, livePosition);
  }, [safestRoute, isNavigating, livePosition]);

  // Coverage-colored segments for the route-preview map (before navigation starts) —
  // this is what actually shows *why* a path was picked as the safest one.
  const safestRouteSegments = useMemo(() => {
    if (isNavigating || !safestRoute) return [];
    return buildCoverageSegments(safestRoute, lights, businesses);
  }, [isNavigating, safestRoute, lights, businesses]);

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
        setDirections(data.steps);
        setMapCenter([nearestHub.lat, nearestHub.lng]);
        setCurrentStepIndex(0);
        setFollowMode(true);
        lastAnnouncedIndexRef.current = -1;
        setIsNavigating(true);
        setShowDirections(true);
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
    const startingNav = !isNavigating;
    setIsNavigating(startingNav);

    if (startingNav) {
      setShowDirections(true);
      setCurrentStepIndex(0);
      setFollowMode(true);
      lastAnnouncedIndexRef.current = -1;
      prevLivePositionRef.current = null;
      if (userLocation) setMapCenter(userLocation);
    } else {
      window.speechSynthesis?.cancel();
    }
    showNotification(startingNav ? "Live Tracking Started! Follow the green path." : "Live Tracking Ended.", "success");
  };

  const timeString = (() => {
    const h = temporalHour % 24;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(temporalMinute).padStart(2, "0")} ${ampm}`;
  })();

  const currentStep = isNavigating ? directions[currentStepIndex] : null;
  const etaLabel = navStats.remainingDuration > 0
    ? new Date(nowMs + navStats.remainingDuration * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "--";

  return (
    <div style={styles.app}>
      {notification && <div style={{ ...styles.toast, borderColor: toastColors[notification.type] }}>{notification.msg}</div>}
      {isNightMode && <div style={styles.nightOverlay} />}

      <div style={styles.mapContainer}>
        <MapContainer center={mapCenter} zoom={14} style={{ width: "100%", height: "100%" }} zoomControl={false}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            className={isNightMode ? "detailed-dark-map" : ""}
          />
          <MapRecenter center={mapCenter} zoom={isNavigating ? NAV_ZOOM : undefined} />
          <MapClickHandler onMapClick={handleMapClick} />
          <FollowModeHandler active={isNavigating} onUserDrag={() => setFollowMode(false)} />

          {startLocation && !isNavigating && <Marker position={[startLocation.lat, startLocation.lng]} icon={createIcon("#22d3ee", 16)} />}
          {destination && <Marker position={[destination.lat, destination.lng]} icon={createIcon("#f472b6", 16)} />}

          {livePosition && isNavigating && (
            <Marker position={livePosition} icon={createHeadingIcon(heading)}>
              <Popup>You are here</Popup>
            </Marker>
          )}

          {!isNavigating && safestRouteSegments.map((seg, i) => (
            <Polyline
              key={i}
              positions={seg.coords}
              pathOptions={{
                color: seg.covered ? "#10b981" : "#f59e0b",
                weight: 6,
                opacity: 0.95,
                lineCap: "round",
                dashArray: seg.covered ? null : "2,10",
              }}
            />
          ))}
          {isNavigating && safestRoute && (
            <>
              {routeProgress && routeProgress.index > 0 && (
                <Polyline positions={safestRoute.slice(0, routeProgress.index + 1)} pathOptions={{ color: "#475569", weight: 5, opacity: 0.6 }} />
              )}
              <Polyline positions={routeProgress ? safestRoute.slice(routeProgress.index) : safestRoute} pathOptions={{ color: "#10b981", weight: 6, opacity: 0.95, lineCap: "round" }} />
            </>
          )}
          {dangerRoute && !isNavigating && <Polyline positions={dangerRoute} pathOptions={{ color: "#ef4444", weight: 3.5, opacity: 0.8, dashArray: "6,8" }} />}

          {lights.map((l) => (
            <div key={l.id}>
              <Marker position={[l.lat, l.lng]} icon={l.status === "online" ? streetlightIcon : brokenLightIcon} />
              {l.status === "online" && (
                <Circle
                  center={[l.lat, l.lng]}
                  radius={LIGHT_COVERAGE_RADIUS_M}
                  pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: isNightMode ? 0.09 : 0.04, weight: 1 }}
                />
              )}
            </div>
          ))}

          {businesses.map((b) => (
            <div key={b.id}>
              <Marker position={[b.lat, b.lng]} icon={b.open ? shopIcon : closedShopIcon}>
                <Popup><div className="text-black font-bold text-xs p-1">{b.name} — {b.open ? "Open now" : "Closed"}</div></Popup>
              </Marker>
              {b.open && (
                <Circle
                  center={[b.lat, b.lng]}
                  radius={BUSINESS_COVERAGE_RADIUS_M}
                  pathOptions={{ color: "#10b981", fillColor: "#10b981", fillOpacity: 0.06, weight: 1, dashArray: "4,4" }}
                />
              )}
            </div>
          ))}
          {hazardPins.map((h) => <Marker key={h.id} position={[h.lat, h.lng]} icon={hazardIcon} />)}
          {refugeHubs.map((hub) => <Marker key={hub.id} position={[hub.lat, hub.lng]} icon={emergencyRefugeIcon}><Popup><div className="text-black font-bold text-xs p-1">{hub.name} ({hub.type})</div></Popup></Marker>)}

          {sosActive && (livePosition || startLocation) && (
            <Circle center={livePosition || [startLocation.lat, startLocation.lng]} radius={500} pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.12 }} />
          )}

          {!isNavigating && <MapBoundsUpdater standardRoute={dangerRoute} shadowPathRoute={safestRoute} />}
        </MapContainer>

        {isNavigating && currentStep && (
          <div style={styles.navBanner}>
            <div style={styles.navBannerIcon}>
              {(() => {
                const { Icon, angle } = getManeuverVisual(currentStep);
                return <Icon size={30} style={{ transform: `rotate(${angle}deg)` }} />;
              })()}
            </div>
            <div style={styles.navBannerText}>
              <div style={styles.navBannerDistance}>{formatDistance(navStats.distanceToNext)}</div>
              <div style={styles.navBannerInstruction}>{currentStep.text}</div>
            </div>
            <button style={styles.voiceBtn} onClick={() => setVoiceEnabled((v) => !v)} title={voiceEnabled ? "Mute voice guidance" : "Unmute voice guidance"}>
              {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          </div>
        )}

        {isNavigating && !followMode && (
          <button style={styles.recenterBtn} onClick={() => { setFollowMode(true); if (livePosition) setMapCenter(livePosition); }}>
            <LocateFixed size={16} /> Recenter
          </button>
        )}

        {isNavigating && (
          <div style={styles.navFooter}>
            <span>{formatDistance(navStats.remainingDistance)} remaining</span>
            <span>·</span>
            <span>{formatDuration(navStats.remainingDuration)}</span>
            <span>·</span>
            <span>ETA {etaLabel}</span>
            {isRerouting && <span style={{ color: "#f59e0b", marginLeft: 6 }}>Recalculating…</span>}
          </div>
        )}
      </div>

      <div className="hud-scrollbar" style={styles.hud}>
        <div style={styles.header}>
          <div style={styles.logoBox}><span style={{ fontSize: 22 }}>🛡️</span></div>
          <div><div style={styles.appName}>ShadowPath</div><div style={styles.appSub}>Context-Aware Navigation Engine</div></div>
        </div>

        <div style={styles.locationStatusBox}>
          <span style={{ fontSize: 10 }}>📡</span><span style={{ fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden" }}>{locationStatus}</span>
        </div>

        {safetyScore !== null && safestRoute && (
          <div style={styles.scoreBar}>
            <span style={styles.scoreLabel}>SAFETY SCORE</span>
            <span style={{ ...styles.scoreBadge, background: safetyScore >= 75 ? "#10b981" : "#f59e0b" }}>{safetyScore}% Safe</span>
          </div>
        )}

        <button
          style={{ ...styles.navBtn, background: isNavigating ? "#ef4444" : "#10b981", boxShadow: isNavigating ? "0 0 15px rgba(239,68,68,0.5)" : "0 0 15px rgba(16,185,129,0.3)" }}
          onClick={toggleNavigation}
        >
          {isNavigating ? "🛑 END NAVIGATION" : "🚀 START LIVE TRACKING"}
        </button>

        {/* TURN-BY-TURN DIRECTIONS PANEL */}
        {safestRoute && directions.length > 0 && (
          <div style={styles.directionsBox}>
            <button
              style={styles.directionsToggle}
              onClick={() => setShowDirections(!showDirections)}
            >
              {showDirections ? "🔽 Hide Directions" : "▶️ Show Turn-by-Turn"}
            </button>

            {showDirections && (
              <div className="hud-scrollbar" style={styles.directionsList}>
                {directions.map((dir, idx) => (
                  <div
                    key={idx}
                    style={{
                      ...styles.directionItem,
                      ...(isNavigating && idx === currentStepIndex ? styles.directionItemActive : {}),
                      ...(isNavigating && idx < currentStepIndex ? styles.directionItemDone : {}),
                    }}
                  >
                    <span style={{color: '#10b981', marginRight: '6px', fontSize: '14px'}}>
                      {idx === 0 ? '🏁' : idx === directions.length - 1 ? '📍' : '↱'}
                    </span>
                    {dir.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {safetyScore !== null && safestRoute && (
          <div style={styles.comparisonBox}>
            <div style={{ color: "#94a3b8", fontSize: 9, fontWeight: 700, marginBottom: 6 }}>ENGINE ROUTING COMPARISON</div>
            <div style={styles.metricRow}><span style={{ color: "#cbd5e1" }}>🔴 Standard Route</span><span style={{ color: "#f87171" }}>{routeMetrics.standardDist}</span></div>
            <div style={styles.metricRow}><span style={{ color: "#cbd5e1" }}>🟢 ShadowPath</span><span style={{ color: "#34d399" }}>{routeMetrics.shadowDist}</span></div>
            <div style={{ ...styles.metricRow, paddingBottom: 0 }}><span style={{ color: "#cbd5e1" }}>💡 Lit / Business Coverage</span><span style={{ color: "#34d399" }}>{routeMetrics.coveragePct}%</span></div>
            <div style={{ background: "rgba(99,102,241,0.06)", padding: "6px", borderRadius: 6, fontSize: 10, color: "#a5b4fc", marginTop: 6 }}>💡 Tradeoff: Swapped {routeMetrics.distanceTradeoff} for {routeMetrics.coveragePct}% streetlight/business coverage.</div>
          </div>
        )}

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

        <div style={styles.legendBox}>
          <div style={styles.legendTitle}>MAP LEGEND</div>
          <div style={styles.legendItem}>🟢 Covered by streetlight/business zone</div>
          <div style={styles.legendItem}>🟡 Dotted = dark, uncovered stretch</div>
          <div style={styles.legendItem}>🔴 Riskier alternate route</div>
          <div style={styles.legendItem}>💡 / 🏪 Amber & green rings = coverage radius</div>
          <div style={styles.legendItem}>🔵 <strong>Live GPS Tracker</strong></div>
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
  directionsBox: { background: "rgba(15,23,42,0.9)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" },
  directionsToggle: { background: "rgba(16,185,129,0.1)", border: "none", color: "#34d399", padding: "10px", fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between" },
  directionsList: { maxHeight: "200px", overflowY: "auto", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 8 },
  directionItem: { color: "#e0e7ff", fontSize: 11, borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 6 },
  directionItemActive: { background: "rgba(16,185,129,0.12)", borderLeft: "3px solid #10b981", paddingLeft: 6, borderRadius: 4, fontWeight: 700, color: "#fff" },
  directionItemDone: { opacity: 0.35 },
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
  micBtn: { background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 4, borderRadius: 6, flexShrink: 0 },
  micBtnActive: { color: "#ef4444" },
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
  navBanner: { position: "absolute", top: 12, left: 366, right: 12, zIndex: 8, background: "rgba(10,14,30,0.95)", backdropFilter: "blur(16px)", border: "1px solid rgba(16,185,129,0.35)", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.4)" },
  navBannerIcon: { color: "#34d399", flexShrink: 0, display: "flex" },
  navBannerText: { flex: 1, minWidth: 0 },
  navBannerDistance: { color: "#fff", fontSize: 20, fontWeight: 800, lineHeight: 1.1 },
  navBannerInstruction: { color: "#cbd5e1", fontSize: 12, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  voiceBtn: { background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#a5b4fc", padding: 8, cursor: "pointer", display: "flex", flexShrink: 0 },
  navFooter: { position: "absolute", bottom: 12, left: 366, right: 12, zIndex: 8, background: "rgba(10,14,30,0.95)", backdropFilter: "blur(16px)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 12, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, justifyContent: "center", color: "#e0e7ff", fontSize: 12, fontWeight: 600 },
  recenterBtn: { position: "absolute", top: 12, right: 12, zIndex: 8, background: "rgba(10,14,30,0.95)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, color: "#93c5fd", padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, boxShadow: "0 4px 14px rgba(0,0,0,0.4)" },
};
