import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';

// Fix for default leaflet marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to handle map bounds automatically
function MapBounds({ markers }) {
  const map = useMap();
  
  useEffect(() => {
    if (markers.length > 0) {
      const group = new L.featureGroup(markers.map(m => L.marker([m.latitude, m.longitude])));
      map.fitBounds(group.getBounds().pad(0.2));
    }
  }, [markers, map]);
  
  return null;
}

export default function MapComponent({ data, isDiamondMode }) {
  const validData = data.filter(d => d.latitude && d.longitude);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Available': return '#10b981'; // emerald-500
      case 'Travelling': return '#f59e0b'; // amber-500
      case 'Assigned': return '#3b82f6'; // blue-500
      case 'On Hold': return '#ef4444'; // red-500
      default: return '#6b7280'; // gray-500
    }
  };

  const createCustomIcon = (status) => {
    if (isDiamondMode) {
      const markerHtml = `<div style="font-size: 20px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">💎</div>`;
      return L.divIcon({ html: markerHtml, className: 'custom-marker-diamond bg-transparent border-none', iconSize: [24, 24], iconAnchor: [12, 12] });
    }

    const color = getStatusColor(status);
    const markerHtml = `
      <div style="
        background-color: ${color}; 
        width: 16px; height: 16px; 
        border-radius: 50%; border: 3px white solid;
        box-shadow: 0 0 10px rgba(0,0,0,0.3);
      "></div>
    `;
    return L.divIcon({ html: markerHtml, className: 'custom-marker', iconSize: [16, 16] });
  };

  return (
    <div className="h-[500px] w-full rounded-2xl overflow-hidden border border-gray-200 shadow-sm z-0">
      <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        
        {validData.map((rec) => (
          <Marker 
            key={rec.id || Math.random()} 
            position={[rec.latitude, rec.longitude]}
            icon={createCustomIcon(rec.status)}
          >
            <Popup minWidth={220} className="custom-popup rounded-xl shadow-lg">
              <div className="p-1 min-w-[200px]">
                <h3 className="font-bold text-gray-800 text-base border-b border-gray-100 pb-1 mb-2">{rec.engineer}</h3>
                <div className="text-xs text-gray-500 mb-3 bg-gray-50 px-2 py-1 rounded inline-block">ID: {rec.employeeId || 'N/A'}</div>
                
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                  <div className="text-gray-500 font-medium">Status:</div>
                  <div className="font-bold" style={{ color: getStatusColor(rec.status) }}>{rec.status}</div>
                  
                  <div className="text-gray-500 font-medium">Time:</div>
                  <div className="font-medium text-gray-700">{rec.time || rec.loginTime || 'N/A'}</div>
                  
                  <div className="text-gray-500 font-medium">Ticket:</div>
                  <div className="font-medium text-gray-700 truncate max-w-[120px]" title={rec.ticketId}>{rec.ticketId || '-'}</div>
                  
                  <div className="text-gray-500 font-medium">Location:</div>
                  <div className="font-medium text-gray-700">{rec.city || 'N/A'}</div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
        
        <MapBounds markers={validData} />
      </MapContainer>
    </div>
  );
}
