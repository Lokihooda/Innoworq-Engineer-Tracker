// Global variables to track state
let map; 
let markers = []; 
let markerGroup = L.featureGroup(); // Better management for clearing/scaling

// 1. Setup on Page Load
window.addEventListener('DOMContentLoaded', () => {
    const filterDateInput = document.getElementById('filterDate');
    
    if (filterDateInput) {
        // Set default value to today's date
        const today = new Date().toISOString().split('T')[0];
        filterDateInput.value = today;

        // Trigger loadMapData whenever the date is changed manually
        filterDateInput.addEventListener('change', loadMapData);
    }

    // Initial load when page opens
    loadMapData();
});

async function loadMapData() {
    const selectedDate = document.getElementById('filterDate').value;
    console.log("Filtering map for date:", selectedDate);

    // 2. Fetch filtered data from Supabase
    const { data, error } = await _supabase
        .from('engineer_tracking')
        .select('*')
        .eq('date', selectedDate);

    if (error) {
        console.error("Supabase Fetch Error:", error.message);
        return;
    }

    // 3. Clear existing markers from the map and the group
    markerGroup.clearLayers();
    markers = [];

    // 4. Process Records
    data.forEach(rec => {
        if (rec.latitude && rec.longitude) {
            // Color Logic (Green: Available, Orange: Travelling, Red: Everything else)
            let color = rec.status === 'Available' ? "#22c55e" : 
                        (rec.status === 'Travelling' ? "#f59e0b" : "#ef4444");

            const markerHtml = `
                <div style="background-color: ${color}; 
                width: 14px; height: 14px; 
                border-radius: 50%; border: 2px white solid;
                box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>`;
            
            const customIcon = L.divIcon({ 
                html: markerHtml, 
                className: 'custom-marker',
                iconSize: [14, 14] 
            });

            // Create Marker with combined details from both your versions
            const m = L.marker([rec.latitude, rec.longitude], { icon: customIcon })
                .bindPopup(`
                    <div style="font-family: sans-serif; min-width: 150px;">
                        <strong style="color:#667eea; font-size: 1.1em;">${rec.engineer}</strong><br>
                        <b>ID:</b> ${rec.employeeId || 'N/A'}<br>
                        <b>Time:</b> ${rec.loginTime || 'N/A'}<br>
                        <b>Status:</b> <span style="color:${color}; font-weight:bold;">${rec.status}</span><br>
                        <b>City:</b> ${rec.city}
                    </div>
                `);
            
            markers.push(m);
            m.addTo(markerGroup);
        }
    });

    // 5. Add the group to the map
    markerGroup.addTo(map);

    // 6. Viewport Logic
    if (markers.length > 0) {
        // Zoom to fit all markers found for that date
        map.fitBounds(markerGroup.getBounds().pad(0.2)); 
        console.log(`Success: Displaying ${markers.length} engineers.`);
    } else {
        // Fallback view if no data for that day
        map.setView([20.5937, 78.9629], 5);
        console.warn("No tracking data found for this specific date.");
    }
}
