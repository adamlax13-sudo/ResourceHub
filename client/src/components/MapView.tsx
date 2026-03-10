import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Map, { Marker, Popup, NavigationControl, Source, Layer } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import type { LayerProps } from "react-map-gl/mapbox";
import type { GeoJSONSource, MapLayerMouseEvent } from "mapbox-gl";
import { MapPin, MousePointerClick } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

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

// ── Category color map ──────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  // Crisis — red
  "Crisis Lines": "#DC2626",
  "Crisis Services": "#DC2626",
  // Mental health — blue
  "Mental Health & Counselling": "#2563EB",
  "Trauma & PTSD Support": "#2563EB",
  "Grief & Bereavement": "#2563EB",
  "Eating Disorder Services": "#2563EB",
  // Housing — green
  "Emergency Shelter": "#16A34A",
  "Transitional Housing": "#16A34A",
  "Affordable Housing": "#16A34A",
  "Supportive Housing": "#16A34A",
  // Substance — orange
  "Addiction Treatment": "#EA580C",
  "Residential Treatment": "#EA580C",
  "Detox & Withdrawal": "#EA580C",
  "Harm Reduction": "#EA580C",
  "Recovery & Peer Support": "#EA580C",
  "Gambling Support": "#EA580C",
  // Youth/family — purple
  "Youth Services": "#9333EA",
  "Family & Parenting Support": "#9333EA",
  "Campus & Student Services": "#9333EA",
  // Community — teal
  "Community & Social Connection": "#0D9488",
  "Indigenous Services": "#0D9488",
  "Newcomer & Settlement": "#0D9488",
  "LGBTQ2S+ Services": "#0D9488",
  "Senior Services": "#0D9488",
  "Veterans Services": "#0D9488",
  // Practical — amber
  "Food Banks & Meals": "#D97706",
  "Basic Needs & Material Aid": "#D97706",
  "Employment Services": "#D97706",
  "Transportation Assistance": "#D97706",
  "Financial Counselling & Debt Help": "#D97706",
  // Other — slate
  "Disability & Autism Support": "#475569",
  "Domestic Violence Support": "#475569",
  "Healthcare Access": "#475569",
  "Legal Aid": "#475569",
  "Criminal Justice Reintegration": "#475569",
  "Sexual Health Services": "#475569",
  "Human Trafficking Support": "#475569",
};

const DEFAULT_MARKER_COLOR = "#D6001C";

// ── Inverted polygon: world exterior with Alberta cut out as a hole ──
const ALBERTA_MASK_GEOJSON: GeoJSON.Feature = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]],
      [
        [-110.0, 49.0], [-110.0, 60.0], [-120.0, 60.0], [-120.0, 54.6],
        [-119.8, 54.3], [-119.5, 54.0], [-119.1, 53.7], [-118.7, 53.4],
        [-118.3, 53.1], [-117.9, 52.8], [-117.6, 52.5], [-117.3, 52.2],
        [-117.0, 51.9], [-116.7, 51.6], [-116.4, 51.3], [-116.1, 51.05],
        [-115.8, 50.8], [-115.55, 50.55], [-115.35, 50.3], [-115.15, 50.0],
        [-114.9, 49.7], [-114.7, 49.5], [-114.45, 49.25], [-114.07, 49.0],
        [-110.0, 49.0],
      ],
    ],
  },
};

// ── Layer definitions ────────────────────────────────────────────────
const albertaMaskLayer: LayerProps = {
  id: "alberta-mask",
  type: "fill",
  paint: {
    "fill-color": "#f5f5f0",
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

const clusterLayer: LayerProps = {
  id: "clusters",
  type: "circle",
  source: "services",
  filter: ["has", "point_count"],
  paint: {
    "circle-color": "#D6001C",
    "circle-opacity": 0.85,
    "circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 50, 32],
    "circle-stroke-width": 2,
    "circle-stroke-color": "#ffffff",
  },
};

const clusterCountLayer: LayerProps = {
  id: "cluster-count",
  type: "symbol",
  source: "services",
  filter: ["has", "point_count"],
  layout: {
    "text-field": "{point_count_abbreviated}",
    "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
    "text-size": 13,
  },
  paint: {
    "text-color": "#ffffff",
  },
};

const unclusteredPointLayer: LayerProps = {
  id: "unclustered-point",
  type: "circle",
  source: "services",
  filter: ["!", ["has", "point_count"]],
  paint: {
    "circle-color": ["get", "color"],
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 5, 10, 7, 14, 9],
    "circle-stroke-width": 2,
    "circle-stroke-color": "#ffffff",
    "circle-opacity": 0.9,
  },
};

// ── Legend items ──────────────────────────────────────────────────────
const LEGEND_ITEMS = [
  { color: "#DC2626", label: "Crisis" },
  { color: "#2563EB", label: "Mental Health" },
  { color: "#16A34A", label: "Housing" },
  { color: "#EA580C", label: "Substance Use" },
  { color: "#9333EA", label: "Youth & Family" },
  { color: "#0D9488", label: "Community" },
  { color: "#D97706", label: "Basic Needs" },
  { color: "#475569", label: "Other" },
];

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
  const [mapCursor, setMapCursor] = useState("default");

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

  // GeoJSON for clustered source
  const serviceGeoJSON = useMemo((): GeoJSON.FeatureCollection => ({
    type: "FeatureCollection",
    features: mappableServices.map((svc) => ({
      type: "Feature" as const,
      properties: {
        id: svc.id,
        name: svc.name,
        category: svc.category,
        distanceKm: svc.distanceKm ?? null,
        color: CATEGORY_COLORS[svc.category] || DEFAULT_MARKER_COLOR,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [svc.longitude!, svc.latitude!],
      },
    })),
  }), [mappableServices]);

  const initialViewState = useMemo(() => ({
    ...ALBERTA_CENTER,
    zoom: 5,
    pitch: 30,
  }), []);

  // Auto-fit bounds to search results
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || mappableServices.length === 0) return;

    const doFit = () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mapboxgl = (map as unknown as { _mapboxgl?: typeof import("mapbox-gl") })._mapboxgl;
      // Use the map's own LngLatBounds
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
          { padding: { top: 60, bottom: 60, left: 60, right: 60 }, maxZoom: 13, pitch: 30, duration: 800 }
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

    const PADDING = 40;
    const POPUP_HEIGHT = 170;
    const POPUP_HALF_WIDTH = 120;

    const markerPx = map.project([lng, lat]);
    const canvas = map.getCanvas();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    let dx = 0;
    let dy = 0;

    const popupTop = markerPx.y - 36 - POPUP_HEIGHT;
    if (popupTop < PADDING) {
      dy = popupTop - PADDING;
    }
    if (markerPx.y > h - PADDING) {
      dy = markerPx.y - (h - PADDING);
    }
    if (markerPx.x - POPUP_HALF_WIDTH < PADDING) {
      dx = (markerPx.x - POPUP_HALF_WIDTH) - PADDING;
    }
    if (markerPx.x + POPUP_HALF_WIDTH > w - PADDING) {
      dx = (markerPx.x + POPUP_HALF_WIDTH) - (w - PADDING);
    }

    if (dx !== 0 || dy !== 0) {
      map.panBy([dx, dy], { duration: 400, easing: (t) => t * (2 - t) });
    }
  }, []);

  // Handle clicks on clusters (zoom in) and unclustered points (show popup)
  const handleMapClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;

      setIsActive(true);

      // Click on cluster → zoom in
      if (feature.layer?.id === "clusters" && feature.properties?.cluster_id != null) {
        const source = mapRef.current?.getSource("services") as GeoJSONSource | undefined;
        if (!source) return;
        source.getClusterExpansionZoom(feature.properties.cluster_id, (err: unknown, zoom: number | null | undefined) => {
          if (err || zoom == null) return;
          const coords = (feature.geometry as GeoJSON.Point).coordinates;
          mapRef.current?.easeTo({ center: [coords[0], coords[1]], zoom, duration: 500 });
        });
        return;
      }

      // Click on unclustered point → show popup
      if (feature.layer?.id === "unclustered-point" && feature.properties?.id) {
        const coords = (feature.geometry as GeoJSON.Point).coordinates;
        setSelectedId((prev) =>
          prev === feature.properties!.id ? null : feature.properties!.id
        );
        requestAnimationFrame(() => ensurePopupVisible(coords[1], coords[0]));
      }
    },
    [ensurePopupVisible]
  );

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
      className="rounded-2xl overflow-hidden border border-border shadow-lg h-[calc(100vh-200px)] relative"
      role="application"
      aria-label="Map showing service locations"
    >
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
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
        terrain={{ source: "mapbox-dem", exaggeration: 1.5 }}
        maxPitch={60}
        scrollZoom={false}
        dragPan={false}
        doubleClickZoom={false}
        touchZoomRotate={false}
        interactiveLayerIds={["clusters", "unclustered-point"]}
        onClick={handleMapClick}
        onMouseEnter={() => setMapCursor("pointer")}
        onMouseLeave={() => setMapCursor("default")}
        cursor={mapCursor}
      >
        <NavigationControl position="top-right" />

        {/* 3D terrain */}
        <Source
          id="mapbox-dem"
          type="raster-dem"
          url="mapbox://mapbox.mapbox-terrain-dem-v1"
          tileSize={512}
          maxzoom={14}
        />

        {/* Alberta highlight mask */}
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

        {/* Clustered service markers */}
        <Source
          id="services"
          type="geojson"
          data={serviceGeoJSON}
          cluster={true}
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          <Layer {...clusterLayer} />
          <Layer {...clusterCountLayer} />
          <Layer {...unclusteredPointLayer} />
        </Source>

        {/* Popup for selected service */}
        {selectedService && selectedService.latitude != null && selectedService.longitude != null && (
          <Popup
            latitude={selectedService.latitude}
            longitude={selectedService.longitude}
            anchor="bottom"
            offset={[0, -12] as [number, number]}
            closeOnClick={false}
            onClose={() => setSelectedId(null)}
            className="map-popup"
          >
            <div className="p-2 max-w-[220px]">
              <p className="font-medium text-sm text-foreground leading-tight">
                {selectedService.name}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[selectedService.category] || DEFAULT_MARKER_COLOR }}
                />
                <p className="text-xs text-muted-foreground">{selectedService.category}</p>
              </div>
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

      {/* Category color legend */}
      <div className="absolute bottom-3 left-3 z-10 bg-white/90 backdrop-blur-sm rounded-lg border border-border shadow-sm px-3 py-2 text-xs">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {LEGEND_ITEMS.map((item) => (
            <div key={item.color} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
