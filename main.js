// 1. Set default date to today on page load
window.addEventListener('DOMContentLoaded', () => {
    const filterDateInput = document.getElementById('filterDate');
    if (filterDateInput) {
        const today = new Date().toISOString().split('T')[0];
        filterDateInput.value = today;
    }
    // Optional: Auto-load data on startup
    loadMapData();
});

async function loadMapData() {
    const selectedDate = document.getElementById('filterDate').value;
    
    // 2. Fetch data filtered by the selected date
    const { data, error } = await _supabase
        .from('engineer_tracking')
        .select('*')
        .eq('date', selectedDate);

    if (error) {
        console.error("Error fetching map data:", error);
        return;
    }

    // 3. Clear existing markers from the map
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    
    // Create a feature group to manage markers and handle auto-zooming
    let group = new L.featureGroup(); 

    data.forEach(rec => {
        if(rec.latitude && rec.longitude) {
            // 4. Color Logic (Green: Available, Orange: Travelling, Red: Others)
            let color = rec.status === 'Available' ? "#22c55e" : 
                        (rec.status === 'Travelling' ? "#f59e0b" : "#ef4444");

            const markerHtml = `<div style="background-color: ${color}; 
                                width: 14px; height: 14px; 
                                border-radius: 50%; border: 2px white solid;
                                box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>`;
            
            const customIcon = L.divIcon({ 
                html: markerHtml, 
                className: 'custom-marker',
                iconSize: [14, 14] 
            });

            // 5. Create Marker with merged Popup details
            const m = L.marker([rec.latitude, rec.longitude], { icon: customIcon })
                .bindPopup(`
                    <div style="font-family: sans-serif; line-height: 1.5;">
                        <strong style="color:#667eea; font-size: 1.1em;">${rec.engineer}</strong><br>
                        <b>ID:</b> ${rec.employeeId || 'N/A'}<br>
                        <b>Time:</b> ${rec.loginTime || 'N/A'}<br>
                        <b>Status:</b> <span style="color:${color}; font-weight:bold;">${rec.status}</span><br>
                        <b>City:</b> ${rec.city}<br>
                    </div>
                `);
            
            markers.push(m);
            m.addTo(group);
        }
    });

    group.addTo(map);

    // 6. Viewport adjustment
    if (markers.length > 0) {
        // Auto-zoom to fit all markers with a bit of padding
        map.fitBounds(group.getBounds().pad(0.2)); 
    } else {
        // Reset to default view (India) if no results found
        map.setView([20.5937, 78.9629], 5);
        console.log("No tracking data found for " + selectedDate);
    }
}
