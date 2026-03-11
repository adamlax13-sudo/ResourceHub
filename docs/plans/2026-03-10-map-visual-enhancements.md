# Map Visual Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the flat, grey map into a visually rich experience with terrain, clustering, auto-fit bounds, category-colored markers, and subtle 3D tilt.

**Architecture:** All changes are in `client/src/components/MapView.tsx` (and its props in `Home.tsx`). Switch from individual `<Marker>` components to a GeoJSON `<Source>` with `<Layer>` for clustering and category coloring. Add Mapbox terrain DEM source for 3D elevation. No backend changes needed.

**Tech Stack:** react-map-gl v7, mapbox-gl, Mapbox `outdoors-v12` style, Mapbox terrain DEM tiles.

---

## Category Color Map

37 categories grouped into 8 color buckets to keep the map readable:

| Color | Hex | Categories |
|-------|-----|------------|
| Red (crisis) | `#DC2626` | Crisis Lines, Crisis Services |
| Blue (mental health) | `#2563EB` | Mental Health & Counselling, Trauma & PTSD Support, Grief & Bereavement, Eating Disorder Services |
| Green (housing) | `#16A34A` | Emergency Shelter, Transitional Housing, Affordable Housing, Supportive Housing |
| Orange (substance) | `#EA580C` | Addiction Treatment, Residential Treatment, Detox & Withdrawal, Harm Reduction, Recovery & Peer Support, Gambling Support |
| Purple (youth/family) | `#9333EA` | Youth Services, Family & Parenting Support, Campus & Student Services |
| Teal (community) | `#0D9488` | Community & Social Connection, Indigenous Services, Newcomer & Settlement, LGBTQ2S+ Services, Senior Services, Veterans Services |
| Amber (practical) | `#D97706` | Food Banks & Meals, Basic Needs & Material Aid, Employment Services, Transportation Assistance, Financial Counselling & Debt Help |
| Slate (other) | `#475569` | Disability & Autism Support, Domestic Violence Support, Healthcare Access, Legal Aid, Criminal Justice Reintegration, Sexual Health Services, Human Trafficking Support |

---

## Task 1: Switch map style to `outdoors-v12`

**Files:**
- Modify: `client/src/components/MapView.tsx:280`

**Step 1: Change mapStyle prop**

In the `<Map>` component, change:
```tsx
mapStyle="mapbox://styles/mapbox/light-v11"
```
to:
```tsx
mapStyle="mapbox://styles/mapbox/outdoors-v12"
```

**Step 2: Update the Alberta mask color**

The mask overlay uses `#FAF6F0` which matched `light-v11`'s background. `outdoors-v12` has a slightly different base. Update the mask to be semi-transparent white so it works with any style:

Change `albertaMaskLayer` paint:
```tsx
"fill-color": "#f5f5f0",
```

**Step 3: Verify**

Run `npm run check` — no type changes, this is just a string swap.

**Step 4: Commit**
```
feat(map): switch to outdoors-v12 style for terrain visibility
```

---

## Task 2: Add 3D terrain with subtle tilt

**Files:**
- Modify: `client/src/components/MapView.tsx`

**Step 1: Add terrain DEM source and sky layer**

Add a new `<Source>` for the Mapbox terrain DEM tiles inside the `<Map>` component, right after the opening `<Map>` tag and before `<NavigationControl>`:

```tsx
{/* 3D terrain */}
<Source
  id="mapbox-dem"
  type="raster-dem"
  url="mapbox://mapbox.mapbox-terrain-dem-v1"
  tileSize={512}
  maxzoom={14}
/>
```

**Step 2: Add terrain and pitch props to `<Map>`**

Add these props to the `<Map>` component:
```tsx
terrain={{ source: "mapbox-dem", exaggeration: 1.5 }}
pitch={30}
maxPitch={60}
```

The `pitch={30}` sets a subtle default tilt. `exaggeration: 1.5` makes mountains more visible without looking cartoonish. `maxPitch={60}` prevents users from tilting too far (performance + usability).

**Step 3: Update initialViewState**

Add `pitch: 30` to all three return paths in the `initialViewState` useMemo so the map always starts tilted:
- User location path: `{ latitude: userLocation.lat, longitude: userLocation.lng, zoom: 10, pitch: 30 }`
- First service path: `{ latitude: ..., longitude: ..., zoom: 10, pitch: 30 }`
- Default Alberta path: `{ ...ALBERTA_CENTER, zoom: 5, pitch: 30 }`

**Step 4: Verify**

Run `npm run check`. No new dependencies — terrain is a built-in Mapbox feature.

**Step 5: Commit**
```
feat(map): add 3D terrain with subtle 30-degree tilt
```

---

## Task 3: Convert individual markers to clustered GeoJSON source

This is the biggest task. We're replacing the `mappableServices.map((svc) => <Marker>)` pattern with a GeoJSON `<Source cluster={true}>` and `<Layer>` components for clusters, counts, and unclustered points.

**Files:**
- Modify: `client/src/components/MapView.tsx`

**Step 1: Add the category color map constant**

Add above the component function:

```tsx
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

const DEFAULT_MARKER_COLOR = "#D6001C"; // brand red fallback
```

**Step 2: Build GeoJSON FeatureCollection from services**

Add a `useMemo` inside the component that converts `mappableServices` into a GeoJSON FeatureCollection. Each feature needs `id`, `name`, `category`, `distanceKm`, and `color` in its properties:

```tsx
const serviceGeoJSON = useMemo((): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: mappableServices.map((svc) => ({
    type: "Feature",
    properties: {
      id: svc.id,
      name: svc.name,
      category: svc.category,
      distanceKm: svc.distanceKm ?? null,
      color: CATEGORY_COLORS[svc.category] || DEFAULT_MARKER_COLOR,
    },
    geometry: {
      type: "Point",
      coordinates: [svc.longitude!, svc.latitude!],
    },
  })),
}), [mappableServices]);
```

**Step 3: Define cluster and unclustered layers**

Add these layer definitions (as constants outside the component, like the existing `albertaMaskLayer`):

```tsx
const clusterLayer: LayerProps = {
  id: "clusters",
  type: "circle",
  source: "services",
  filter: ["has", "point_count"],
  paint: {
    "circle-color": "#D6001C",
    "circle-opacity": 0.85,
    "circle-radius": [
      "step", ["get", "point_count"],
      18,     // < 10
      10, 24, // 10-49
      50, 32, // 50+
    ],
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
    "circle-radius": [
      "interpolate", ["linear"], ["zoom"],
      5, 5,
      10, 7,
      14, 9,
    ],
    "circle-stroke-width": 2,
    "circle-stroke-color": "#ffffff",
    "circle-opacity": 0.9,
  },
};
```

Key design decisions:
- Clusters use brand red (`#D6001C`) with white stroke and white count text.
- Unclustered points use `["get", "color"]` to read each feature's category color from properties.
- Circle radius scales with zoom so points don't overwhelm at low zoom.

**Step 4: Replace individual Markers with clustered Source**

Remove the `{/* Service markers */}` block (`mappableServices.map((svc) => <Marker ...>)`) and replace it with:

```tsx
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
```

**Step 5: Add `interactiveLayerIds` to `<Map>` and handle click**

Add `interactiveLayerIds` prop to `<Map>`:
```tsx
interactiveLayerIds={["clusters", "unclustered-point"]}
```

Add an `onClick` prop to `<Map>`:
```tsx
onClick={handleMapClick}
```

Define `handleMapClick` in the component:
```tsx
const handleMapClick = useCallback(
  (event: mapboxgl.MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature) return;

    setIsActive(true);

    // Click on cluster → zoom in
    if (feature.layer.id === "clusters" && feature.properties?.cluster_id != null) {
      const source = mapRef.current?.getSource("services") as mapboxgl.GeoJSONSource | undefined;
      if (!source) return;
      source.getClusterExpansionZoom(feature.properties.cluster_id, (err, zoom) => {
        if (err || zoom == null) return;
        const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
        mapRef.current?.easeTo({ center: [lng, lat], zoom, duration: 500 });
      });
      return;
    }

    // Click on unclustered point → show popup
    if (feature.layer.id === "unclustered-point" && feature.properties?.id) {
      const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
      setSelectedId((prev) =>
        prev === feature.properties!.id ? null : feature.properties!.id
      );
      requestAnimationFrame(() => ensurePopupVisible(lat, lng));
    }
  },
  [ensurePopupVisible]
);
```

Add `import type mapboxgl from "mapbox-gl";` at the top of the file (or import inline).

**Step 6: Remove the old `handleMarkerClick` callback**

It's no longer needed since we handle all clicks through `handleMapClick`.

**Step 7: Add cursor pointer on hover for interactive layers**

Add `cursor="pointer"` prop to `<Map>`. react-map-gl will automatically show a pointer cursor when hovering over `interactiveLayerIds` layers.

Actually, react-map-gl handles this automatically when `interactiveLayerIds` is set. But to be safe, add an `onMouseEnter`/`onMouseLeave` for the interactive layers:

```tsx
const [mapCursor, setMapCursor] = useState("default");

// on <Map>:
cursor={mapCursor}
onMouseEnter={() => setMapCursor("pointer")}
onMouseLeave={() => setMapCursor("default")}
```

**Step 8: Verify**

Run `npm run check` — ensure no type errors with the GeoJSON types and mapboxgl event types.

**Step 9: Commit**
```
feat(map): add marker clustering with category-colored pins
```

---

## Task 4: Auto-fit bounds to search results

**Files:**
- Modify: `client/src/components/MapView.tsx`

**Step 1: Compute bounds from mappable services**

Add a `useEffect` that runs when `mappableServices` changes (and the map is loaded). It computes a bounding box around all visible services and fits the map to it:

```tsx
useEffect(() => {
  const map = mapRef.current?.getMap();
  if (!map || mappableServices.length === 0) return;

  // Wait for map to be fully loaded
  if (!map.isStyleLoaded()) {
    map.once("style.load", () => fitBounds());
  } else {
    fitBounds();
  }

  function fitBounds() {
    const bounds = new mapboxgl.LngLatBounds();

    for (const svc of mappableServices) {
      if (svc.longitude != null && svc.latitude != null) {
        bounds.extend([svc.longitude, svc.latitude]);
      }
    }

    // Include user location if available
    if (userLocation) {
      bounds.extend([userLocation.lng, userLocation.lat]);
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: { top: 60, bottom: 60, left: 60, right: 60 },
        maxZoom: 13,
        pitch: 30,
        duration: 800,
      });
    }
  }
}, [mappableServices, userLocation]);
```

This requires `import mapboxgl from "mapbox-gl";` for `LngLatBounds`.

**Step 2: Simplify initialViewState**

Since we now fit bounds dynamically, the `initialViewState` only needs to provide a reasonable default before the fit runs:

```tsx
const initialViewState = useMemo(() => ({
  ...ALBERTA_CENTER,
  zoom: 5,
  pitch: 30,
}), []);
```

Remove the complex logic that checks `userLocation` and `mappableServices[0]` — that's now handled by `fitBounds`.

**Step 3: Verify**

Run `npm run check`.

**Step 4: Commit**
```
feat(map): auto-fit bounds to show all search results
```

---

## Task 5: Add a legend for category colors

**Files:**
- Modify: `client/src/components/MapView.tsx`

**Step 1: Define legend color buckets**

Add a constant for the legend (only the 8 color groups, not all 37 categories):

```tsx
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
```

**Step 2: Render legend in map container**

Add a collapsible legend overlay in the bottom-left of the map container (inside the outer `<div>`, after the `<Map>` closing tag):

```tsx
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
```

This is compact (2 columns, 4 rows) and sits in the bottom-left where it doesn't compete with the navigation controls (top-right) or the "Click to explore" overlay (center).

**Step 3: Verify**

Run `npm run check`.

**Step 4: Commit**
```
feat(map): add category color legend
```

---

## Task 6: Update CSP if needed and final verification

**Files:**
- Possibly modify: `server/index.ts` (only if terrain tiles need additional CSP domains)

**Step 1: Check CSP**

The terrain DEM source uses `mapbox://mapbox.mapbox-terrain-dem-v1` which resolves to `https://api.mapbox.com/...` — already in our CSP allowlist. No changes should be needed, but verify by:

1. Run `npm run dev`
2. Open browser, toggle to Map view
3. Check DevTools console for CSP violations

**Step 2: Run full type check and build**

```bash
npm run check
npm run build
```

**Step 3: Final commit**
```
chore(map): verify CSP and build for terrain + clustering
```

---

## Verification Checklist

1. Map shows `outdoors-v12` style with visible terrain features (green parks, brown terrain)
2. Mountains in western Alberta show 3D elevation with subtle tilt
3. Zoomed-out view shows numbered cluster circles that expand on click
4. Unclustered pins are color-coded by category (red for crisis, blue for mental health, etc.)
5. Legend in bottom-left shows all 8 color groups
6. Map auto-fits to show all pins from the current search
7. Clicking an unclustered point still opens the popup with service name, category, distance, and "View Details"
8. Click-to-activate still works (overlay, Esc to deactivate)
9. No CSP violations in DevTools console
10. `npm run check` and `npm run build` pass
11. User location blue dot still visible
