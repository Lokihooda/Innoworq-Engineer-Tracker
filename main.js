
async function loadMapData() {
    const { data, error } = await _supabase.from('engineer_tracking').select('*');
    
    if (error) {
        console.error("Error fetching map data:", error);
        return;
    }

    // 1. Clear existing markers
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    
    // 2. Create a feature group to handle auto-zooming
    let group = new L.featureGroup(); 

    data.forEach(rec => {
        if(rec.latitude && rec.longitude) {
            // 3. Define color logic based on status
            // Green for Available, Orange for Travelling, Red for On Hold/Assigned
            let color = "#ef4444"; // Default Red
            if (rec.status === 'Available') color = "#22c55e";
            if (rec.status === 'Travelling') color = "#f59e0b";

            const markerHtml = `<div style="background-color: ${color}; 
                                width: 14px; height: 14px; 
                                border-radius: 50%; border: 2px white solid;
                                box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>`;
            
            const customIcon = L.divIcon({ 
                html: markerHtml, 
                className: 'custom-marker',
                iconSize: [14, 14] 
            });

            const m = L.marker([rec.latitude, rec.longitude], { icon: customIcon })
                .bindPopup(`
                    <div style="font-family: sans-serif;">
                        <strong style="color:#667eea;">${rec.engineer}</strong><br>
                        <b>Status:</b> ${rec.status}<br>
                        <b>City:</b> ${rec.city}<br>
                        <small>ID: ${rec.employeeId}</small>
                    </div>
                `);
            
            markers.push(m);
            m.addTo(group);
        }
    });

    group.addTo(map);

    // 4. Auto-adjust map view to show all engineers
    if (markers.length > 0) {
        map.fitBounds(group.getBounds().pad(0.2)); 
    }
}
