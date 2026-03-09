import { useState, useEffect, useMemo } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import { MapPin } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

interface MapViewProps {
  services: { id: string; name: string; category: string; distanceKm?: number | null }[];
  userLocation: { lat: number; lng: number } | null;
  onSelectService: (serviceId: string) => void;
}

// Alberta centroid
const ALBERTA_CENTER = { latitude: 53.9, longitude: -116.6 };

export default function MapView({ services, userLocation, onSelectService }: MapViewProps) {
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState(false);
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

  const initialViewState = useMemo(() => {
    if (userLocation) {
      return { latitude: userLocation.lat, longitude: userLocation.lng, zoom: 10 };
    }
    return { ...ALBERTA_CENTER, zoom: 5 };
  }, [userLocation]);

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
      className="rounded-2xl overflow-hidden border border-border shadow-lg h-[calc(100vh-200px)]"
      role="application"
      aria-label="Map showing service locations"
    >
      <span className="sr-only" aria-live="polite">
        Showing {services.length} services on map. Use the list view for full accessibility.
      </span>
      <Map
        mapboxAccessToken={token}
        initialViewState={initialViewState}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/light-v11"
      >
        <NavigationControl position="top-right" />

        {/* User location dot */}
        {userLocation && (
          <Marker latitude={userLocation.lat} longitude={userLocation.lng} anchor="center">
            <div className="relative">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 absolute -inset-1.5" />
              <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-md relative" />
            </div>
          </Marker>
        )}

        {/* Service markers + popups will be added once batch geocoding populates
            lat/lng and coordinates are included in the search API response */}
      </Map>
    </div>
  );
}
