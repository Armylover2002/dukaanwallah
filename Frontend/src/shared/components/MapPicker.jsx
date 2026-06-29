import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Circle,
  Autocomplete,
  Polygon,
} from "@react-google-maps/api";
import { Search, MapPin, Navigation, Loader2 } from "lucide-react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { toast } from "sonner";

const libraries = ["places", "geometry"];
const mapContainerStyle = {
  width: "100%",
  height: "400px",
};

const defaultCenter = {
  lat: 20.5937, // India center
  lng: 78.9629,
};

const MapPicker = ({
  isOpen,
  onClose,
  onConfirm,
  initialLocation = null,
  initialRadius = 5,
  maxRadius = 20,
  zoneCoordinates = [],
  zoneLabel = "",
}) => {
  const [center, setCenter] = useState(initialLocation || defaultCenter);
  const [marker, setMarker] = useState(initialLocation);
  const [radius, setRadius] = useState(initialRadius);
  const [address, setAddress] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const autocompleteRef = useRef(null);
  const mapRef = useRef(null);

  const zonePath = React.useMemo(
    () =>
      Array.isArray(zoneCoordinates)
        ? zoneCoordinates
            .map((coord) => ({
              lat: Number(coord?.latitude ?? coord?.lat),
              lng: Number(coord?.longitude ?? coord?.lng),
            }))
            .filter(
              (coord) =>
                Number.isFinite(coord.lat) && Number.isFinite(coord.lng),
            )
        : [],
    [zoneCoordinates],
  );

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  // Initialize map state only once when modal opens
  useEffect(() => {
    if (!isOpen) return;

    // Use initialLocation only for first-time initialization when modal opens
    if (initialLocation) {
      setCenter(initialLocation);
      setMarker(initialLocation);
    } else if (zonePath.length > 0) {
      const avgLat =
        zonePath.reduce((sum, point) => sum + point.lat, 0) / zonePath.length;
      const avgLng =
        zonePath.reduce((sum, point) => sum + point.lng, 0) / zonePath.length;
      setCenter({ lat: avgLat, lng: avgLng });
      setMarker(null);
    } else {
      setCenter(defaultCenter);
      setMarker(null);
    }
    
    if (initialRadius !== undefined) {
      setRadius(initialRadius);
    }
  }, [isOpen]); // Only run when modal opens

  useEffect(() => {
    if (!isLoaded || !isOpen || !mapRef.current || zonePath.length < 3 || !window.google) {
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    zonePath.forEach((point) => bounds.extend(point));
    mapRef.current.fitBounds(bounds);
  }, [isLoaded, isOpen, zonePath]);

  const onMapClick = useCallback((e) => {
    const newPos = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng(),
    };
    setMarker(newPos);
  }, []);

  const onMarkerDragEnd = useCallback((e) => {
    const newPos = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng(),
    };
    setMarker(newPos);
  }, []);

  const handlePlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry) {
        const newPos = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };
        setMarker(newPos);
        setAddress(place.formatted_address || "");
        // Pan and zoom the map imperatively
        if (mapRef.current) {
          mapRef.current.panTo(newPos);
          mapRef.current.setZoom(16);
        } else {
          setCenter(newPos);
        }
      }
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported on this device.");
      return;
    }

    setIsFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newPos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setMarker(newPos);
        setAddress("");
        setIsFetchingLocation(false);
        if (mapRef.current) {
          mapRef.current.panTo(newPos);
          mapRef.current.setZoom(16);
        } else {
          setCenter(newPos);
        }
      },
      () => {
        setIsFetchingLocation(false);
        toast.error("Unable to retrieve your current location. Please allow location access and try again.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  const handleConfirm = async () => {
    if (!marker) {
      toast.error("Please select a location on the map.");
      return;
    }

    if (zonePath.length >= 3 && window.google && window.google.maps.geometry) {
      const point = new window.google.maps.LatLng(marker.lat, marker.lng);
      const polygon = new window.google.maps.Polygon({ paths: zonePath });
      
      const isInside = window.google.maps.geometry.poly.containsLocation(point, polygon);
      
      if (!isInside) {
        toast.error(`The selected location is outside the allowed service zone${zoneLabel ? ` (${zoneLabel})` : ''}. Please select a location within the highlighted area.`);
        return;
      }
    }

    setIsGeocoding(true);
    try {
      // Reverse geocode only on confirmation to save costs
      const geocoder = new window.google.maps.Geocoder();
      const result = await new Promise((resolve, reject) => {
        geocoder.geocode({ location: marker }, (results, status) => {
          if (status === "OK") resolve(results[0]);
          else reject(status);
        });
      });

      onConfirm({
        ...marker,
        radius,
        address: result.formatted_address,
        placeDetails: result,
      });
      onClose();
    } catch (error) {
      console.error("Geocoding failed:", error);
      // Fallback: confirm without address
      onConfirm({
        ...marker,
        radius,
        address: address || "Custom Location",
        placeDetails: null,
      });
      onClose();
    } finally {
      setIsGeocoding(false);
    }
  };

  if (loadError) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Select Location">
        <div className="p-8 text-center text-red-500">
          Failed to load Google Maps. Please check your API key and connection.
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Shop Location"
      size="lg"
      footer={
        <div className="flex flex-col sm:flex-row gap-3 justify-between w-full sm:items-center">
          <div className="text-sm text-gray-500 text-left">
            {marker
              ? address
                ? <span className="font-medium text-slate-700 truncate max-w-[280px] sm:max-w-xs block">{address}</span>
                : `${marker.lat.toFixed(4)}, ${marker.lng.toFixed(4)}`
              : "No location selected"}
          </div>
          <div className="flex gap-2 justify-end w-full sm:w-auto">
            <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-initial">
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!marker || isGeocoding} className="flex-1 sm:flex-initial">
              {isGeocoding ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Confirm Location
            </Button>
          </div>
        </div>
      }>
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            {isLoaded && (
              <Autocomplete
                onLoad={(ref) => (autocompleteRef.current = ref)}
                onPlaceChanged={handlePlaceChanged}
                options={{
                  componentRestrictions: { country: "IN" },
                  fields: ["geometry", "formatted_address"],
                }}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search for your shop area..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </Autocomplete>
            )}
          </div>
          <Button
            variant="outline"
            type="button"
            onClick={getCurrentLocation}
            disabled={isFetchingLocation}
            className="shrink-0 whitespace-nowrap px-4"
            title="Use current location">
            {isFetchingLocation ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="mr-2 h-4 w-4" />
            )}
            {isFetchingLocation ? "Fetching..." : "Use Current Location"}
          </Button>
        </div>

        <div className="rounded-xl overflow-hidden border border-gray-200 shadow-inner relative">
          {!isLoaded ? (
            <div className="h-[400px] flex items-center justify-center bg-gray-50">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={center}
              zoom={15}
              onClick={onMapClick}
              onLoad={(map) => {
                mapRef.current = map;
              }}
              options={{
                disableDefaultUI: true,
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
              }}>
              {zonePath.length >= 3 && (
                <Polygon
                  path={zonePath}
                  options={{
                    fillColor: "#10b981",
                    fillOpacity: 0.14,
                    strokeColor: "#059669",
                    strokeOpacity: 0.9,
                    strokeWeight: 2,
                    clickable: false,
                    editable: false,
                    zIndex: 1,
                  }}
                />
              )}
              {marker && (
                <Marker
                  position={marker}
                  draggable={true}
                  onDragEnd={onMarkerDragEnd}
                  animation={window.google.maps.Animation.DROP}
                />
              )}
            </GoogleMap>
          )}
        </div>

        {zoneLabel ? (
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
              Showing selected zone: {zoneLabel}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default MapPicker;
