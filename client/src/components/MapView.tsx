import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Map, { Marker, Popup, NavigationControl, Source, Layer } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import type { LayerProps } from "react-map-gl/mapbox";
import { MapPin, MousePointerClick } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

// Red accent overrides for Mapbox navigation controls
const mapControlStyles = `
  .map-container .mapboxgl-ctrl-group button .mapboxgl-ctrl-icon {
    filter: brightness(0) saturate(100%) invert(11%) sepia(95%) saturate(6000%) hue-rotate(348deg) brightness(85%) contrast(110%);
  }
`;

interface ServiceMarker {
  id: string;
  name: string;
  category: string;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
}

interface MapViewProps {
  services: ServiceMarker[];
  userLocation: { lat: number; lng: number } | null;
  onSelectService: (serviceId: string) => void;
}

// Alberta centroid
const ALBERTA_CENTER = { latitude: 53.9, longitude: -116.6 };

// Brand red — all pins use the same color to match page style
const PIN_COLOR = "#D6001C";

// Inverted polygon: world exterior with Alberta cut out as a hole
const ALBERTA_MASK_GEOJSON: GeoJSON.Feature = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      // Outer ring: world bounds
      [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]],
      // Inner ring (hole): simplified Alberta boundary
      [
        [-110.0, 49.0],
        [-110.0, 60.0],
        [-120.0, 60.0],
        [-120.0, 54.6],
        [-119.8, 54.3],
        [-119.5, 54.0],
        [-119.1, 53.7],
        [-118.7, 53.4],
        [-118.3, 53.1],
        [-117.9, 52.8],
        [-117.6, 52.5],
        [-117.3, 52.2],
        [-117.0, 51.9],
        [-116.7, 51.6],
        [-116.4, 51.3],
        [-116.1, 51.05],
        [-115.8, 50.8],
        [-115.55, 50.55],
        [-115.35, 50.3],
        [-115.15, 50.0],
        [-114.9, 49.7],
        [-114.7, 49.5],
        [-114.45, 49.25],
        [-114.07, 49.0],
        [-110.0, 49.0],
      ],
    ],
  },
};

const albertaMaskLayer: LayerProps = {
  id: "alberta-mask",
  type: "fill",
  paint: {
    "fill-color": "#FAF6F0",
    "fill-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.55, 7, 0.45, 9, 0.2, 11, 0],
  },
};

const albertaOutlineLayer: LayerProps = {
  id: "alberta-outline",
  type: "line",
  paint: {
    "line-color": "#C8B8A4",
    "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1, 7, 1.5, 10, 1],
    "line-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 9, 0.3, 11, 0],
  },
};


function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export default function MapView({ services, userLocation, onSelectService }: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);

  // Fetch Mapbox public token
  useEffect(() => {
    fetch("/api/mapbox-token")
      .then((r) => {
        if (!r.ok) throw new Error("Token fetch failed");
        return r.json();
      })
      .then((data) => setToken(data.token))
      .catch(() => setTokenError(true));
  }, []);

  // Services that have coordinates
  const mappableServices = useMemo(
    () => services.filter((s) => s.latitude != null && s.longitude != null),
    [services]
  );

  const selectedService = useMemo(
    () => mappableServices.find((s) => s.id === selectedId) ?? null,
    [mappableServices, selectedId]
  );

  const initialViewState = useMemo(() => {
    if (userLocation) {
      return { latitude: userLocation.lat, longitude: userLocation.lng, zoom: 10 };
    }
    if (mappableServices.length > 0) {
      return {
        latitude: mappableServices[0].latitude!,
        longitude: mappableServices[0].longitude!,
        zoom: 10,
      };
    }
    return { ...ALBERTA_CENTER, zoom: 5 };
  }, [userLocation, mappableServices]);

  // Auto-fit bounds to search results
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || mappableServices.length === 0) return;

    const doFit = () => {
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
      for (const svc of mappableServices) {
        if (svc.longitude != null && svc.latitude != null) {
          if (svc.longitude < minLng) minLng = svc.longitude;
          if (svc.longitude > maxLng) maxLng = svc.longitude;
          if (svc.latitude < minLat) minLat = svc.latitude;
          if (svc.latitude > maxLat) maxLat = svc.latitude;
        }
      }
      if (userLocation) {
        if (userLocation.lng < minLng) minLng = userLocation.lng;
        if (userLocation.lng > maxLng) maxLng = userLocation.lng;
        if (userLocation.lat < minLat) minLat = userLocation.lat;
        if (userLocation.lat > maxLat) maxLat = userLocation.lat;
      }
      if (minLng <= maxLng && minLat <= maxLat) {
        map.fitBounds(
          [[minLng, minLat], [maxLng, maxLat]],
          { padding: { top: 60, bottom: 60, left: 60, right: 60 }, maxZoom: 13, duration: 800 }
        );
      }
    };

    if (map.isStyleLoaded()) {
      doFit();
    } else {
      map.once("style.load", doFit);
    }
  }, [mappableServices, userLocation]);

  // Click-to-activate: deactivate when clicking outside or pressing Esc
  useEffect(() => {
    if (!isActive) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsActive(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsActive(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive]);

  // Enable/disable map interactions based on active state
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (isActive) {
      map.scrollZoom.enable();
      map.dragPan.enable();
      map.doubleClickZoom.enable();
      map.touchZoomRotate.enable();
    } else {
      map.scrollZoom.disable();
      map.dragPan.disable();
      map.doubleClickZoom.disable();
      map.touchZoomRotate.disable();
    }
  }, [isActive]);

  const activateMap = useCallback(() => {
    setIsActive(true);
  }, []);

  // Smart pan: only nudge the map enough to keep the popup fully visible
  const ensurePopupVisible = useCallback((lat: number, lng: number) => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const PADDING = 40; // px from map edge
    const POPUP_HEIGHT = 170; // approximate popup height including offset
    const POPUP_HALF_WIDTH = 120; // half of popup max-width

    const markerPx = map.project([lng, lat]);
    const canvas = map.getCanvas();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    // The popup sits above the marker — check if its top/left/right would be clipped
    let dx = 0;
    let dy = 0;

    // Top edge: popup top = marker y - marker height (36) - popup height
    const popupTop = markerPx.y - 36 - POPUP_HEIGHT;
    if (popupTop < PADDING) {
      dy = popupTop - PADDING; // negative = pan up
    }

    // Bottom edge: marker itself below viewport
    if (markerPx.y > h - PADDING) {
      dy = markerPx.y - (h - PADDING);
    }

    // Left edge
    if (markerPx.x - POPUP_HALF_WIDTH < PADDING) {
      dx = (markerPx.x - POPUP_HALF_WIDTH) - PADDING;
    }

    // Right edge
    if (markerPx.x + POPUP_HALF_WIDTH > w - PADDING) {
      dx = (markerPx.x + POPUP_HALF_WIDTH) - (w - PADDING);
    }

    if (dx !== 0 || dy !== 0) {
      map.panBy([dx, dy], { duration: 400, easing: (t) => t * (2 - t) });
    }
  }, []);

  const handleMarkerClick = useCallback((id: string, lat: number, lng: number) => {
    setIsActive(true);
    setSelectedId((prev) => (prev === id ? null : id));
    // Wait a frame for the popup to render, then nudge if needed
    requestAnimationFrame(() => ensurePopupVisible(lat, lng));
  }, [ensurePopupVisible]);

  if (tokenError) {
    return (
      <div className="glass-card p-8 text-center">
        <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground font-medium">Map unavailable</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Use the list view to browse services
        </p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="glass-card p-8 flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="map-container rounded-2xl overflow-hidden border border-border shadow-lg h-[calc(100vh-200px)] relative"
      role="application"
      aria-label="Map showing service locations"
    >
      <style>{mapControlStyles}</style>

      {/* Warm tint overlay — CSS so it covers map tiles uniformly */}
      <div className="absolute inset-0 pointer-events-none z-[1]" style={{ backgroundColor: "rgba(200, 140, 80, 0.08)" }} />

      <span className="sr-only" aria-live="polite">
        Showing {mappableServices.length} services on map. Use the list view for full accessibility.
      </span>

      {/* Click-to-activate overlay */}
      {!isActive && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center cursor-pointer transition-colors hover:bg-black/5"
          onClick={activateMap}
          aria-label="Click to interact with map"
        >
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/90 backdrop-blur-sm border border-border shadow-md text-sm font-medium text-muted-foreground transition-all hover:bg-white hover:shadow-lg hover:text-foreground">
            <MousePointerClick className="w-4 h-4" />
            Click to explore map
          </div>
        </div>
      )}

      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={initialViewState}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        scrollZoom={false}
        dragPan={false}
        doubleClickZoom={false}
        touchZoomRotate={false}
      >
        <NavigationControl position="top-right" />

        {/* Alberta highlight mask — dims areas outside Alberta at wide zoom */}
        <Source id="alberta-mask" type="geojson" data={ALBERTA_MASK_GEOJSON}>
          <Layer {...albertaMaskLayer} />
          <Layer {...albertaOutlineLayer} />
        </Source>

        {/* User location dot */}
        {userLocation && (
          <Marker latitude={userLocation.lat} longitude={userLocation.lng} anchor="center">
            <div className="relative">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 absolute -inset-1.5" />
              <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-md relative" />
            </div>
          </Marker>
        )}

        {/* Service markers */}
        {mappableServices.map((svc) => (
            <Marker
              key={svc.id}
              latitude={svc.latitude!}
              longitude={svc.longitude!}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                handleMarkerClick(svc.id, svc.latitude!, svc.longitude!);
              }}
            >
              <div className="cursor-pointer transition-transform hover:scale-110">
                <svg width="28" height="36" viewBox="0 0 28 36" fill="none">
                  <path
                    d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z"
                    fill={PIN_COLOR}
                  />
                  <circle cx="14" cy="13" r="5" fill="white" />
                </svg>
              </div>
            </Marker>
        ))}

        {/* Popup for selected service */}
        {selectedService && selectedService.latitude != null && selectedService.longitude != null && (
          <Popup
            latitude={selectedService.latitude}
            longitude={selectedService.longitude}
            anchor="bottom"
            offset={[0, -36] as [number, number]}
            closeOnClick={false}
            onClose={() => setSelectedId(null)}
            className="map-popup"
          >
            <div className="p-2 pr-5 max-w-[260px]">
              <p className="font-medium text-sm text-foreground leading-tight">
                {selectedService.name}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{selectedService.category}</p>
              {selectedService.distanceKm != null && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDistance(selectedService.distanceKm)} away
                </p>
              )}
              <button
                onClick={() => onSelectService(selectedService.id)}
                className="mt-2 w-full text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-3 py-1.5 transition-colors"
              >
                View Details
              </button>
            </div>
          </Popup>
        )}
      </Map>

    </div>
  );
}
