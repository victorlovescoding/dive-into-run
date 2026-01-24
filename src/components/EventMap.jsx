// src/components/EventMap.jsx
import React, { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-geosearch/dist/geosearch.css";
import L from "leaflet";
import "leaflet-draw";
import { GeoSearchControl, OpenStreetMapProvider } from "leaflet-geosearch";
import polyline from "@mapbox/polyline";

// Fix for default icon issues with Webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "leaflet/images/marker-icon-2x.png",
  iconUrl: "leaflet/images/marker-icon.png",
  shadowUrl: "leaflet/images/marker-shadow.png",
});

// Draw mode: Leaflet.draw integration
const DrawControl = ({ onRouteDrawn }) => {
  const map = useMap();

  useEffect(() => {
    const editableLayers = new L.FeatureGroup();
    map.addLayer(editableLayers);

    const drawControl = new L.Control.Draw({
      edit: {
        featureGroup: editableLayers,
        remove: true,
      },
      draw: {
        polygon: false,
        marker: false,
        circlemarker: false,
        rectangle: false,
        circle: false,
        polyline: {
          shapeOptions: {
            color: "#f00",
            weight: 5,
            opacity: 0.7,
          },
        },
      },
    });

    map.addControl(drawControl);

    const handleCreated = (e) => {
      const { layer } = e;
      editableLayers.addLayer(layer);

      if (layer instanceof L.Polyline) {
        const latlngs = layer.getLatLngs().map((latlng) => ({
          lat: latlng.lat,
          lng: latlng.lng,
        }));

        if (typeof onRouteDrawn === "function") {
          onRouteDrawn(latlngs);
        }
      }
    };

    const handleDeleted = () => {
      if (editableLayers.getLayers().length === 0) {
        if (typeof onRouteDrawn === "function") {
          onRouteDrawn(null);
        }
      }
    };

    map.on(L.Draw.Event.CREATED, handleCreated);
    map.on(L.Draw.Event.DELETED, handleDeleted);

    return () => {
      map.removeControl(drawControl);
      map.removeLayer(editableLayers);
      map.off(L.Draw.Event.CREATED, handleCreated);
      map.off(L.Draw.Event.DELETED, handleDeleted);
    };
  }, [map, onRouteDrawn]);

  return null;
};

// Draw mode: search bar
const SearchField = () => {
  const map = useMap();

  useEffect(() => {
    const provider = new OpenStreetMapProvider();

    const searchControl = new GeoSearchControl({
      provider,
      style: "bar",
      showMarker: false,
      showPopup: false,
      autoClose: true,
      retainZoomLevel: false,
      animateZoom: true,
      keepResult: true,
      searchLabel: "輸入地點搜尋...",
    });

    map.addControl(searchControl);

    return () => {
      map.removeControl(searchControl);
    };
  }, [map]);

  return null;
};

// View mode: render route polyline + fit bounds
const RouteViewer = ({ encodedPolyline, bbox }) => {
  const map = useMap();

  const latlngs = useMemo(() => {
    if (!encodedPolyline) return null;
    try {
      const decoded = polyline.decode(encodedPolyline);
      // decoded: [[lat, lng], ...]
      return decoded.map(([lat, lng]) => [lat, lng]);
    } catch (e) {
      console.error("decode polyline failed:", e);
      return null;
    }
  }, [encodedPolyline]);

  useEffect(() => {
    if (!latlngs || latlngs.length === 0) return;

    const line = L.polyline(latlngs, {
      color: "#f00",
      weight: 5,
      opacity: 0.8,
    });

    line.addTo(map);

    // 優先用 bbox fitBounds（更快），沒有 bbox 才用線段本身
    try {
      if (bbox && typeof bbox === "object") {
        const sw = L.latLng(bbox.minLat, bbox.minLng);
        const ne = L.latLng(bbox.maxLat, bbox.maxLng);
        map.fitBounds(L.latLngBounds(sw, ne), { padding: [18, 18] });
      } else {
        map.fitBounds(line.getBounds(), { padding: [18, 18] });
      }
    } catch (e) {
      // 忽略 fit 失敗
    }

    return () => {
      map.removeLayer(line);
    };
  }, [map, latlngs, bbox]);

  return null;
};

export default function EventMap({
  mode = "draw",
  onRouteDrawn,
  encodedPolyline,
  bbox,
  height = 500,
}) {
  const taipeiCenter = [25.033964, 121.564468];

  const mapStyle = {
    height: `${height}px`,
    width: "100%",
    borderRadius: "8px",
    zIndex: 0,
  };

  return (
    <MapContainer
      center={taipeiCenter}
      zoom={13}
      scrollWheelZoom={true}
      style={mapStyle}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      {mode === "draw" && (
        <>
          <SearchField />
          <DrawControl onRouteDrawn={onRouteDrawn} />
        </>
      )}

      {mode === "view" && (
        <RouteViewer encodedPolyline={encodedPolyline} bbox={bbox} />
      )}
    </MapContainer>
  );
}
