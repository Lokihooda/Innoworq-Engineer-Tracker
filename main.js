// 1. Initialize Date and Auto-Load
window.addEventListener('DOMContentLoaded', () => {
    const filterDateInput = document.getElementById('filterDate');
    
    if (filterDateInput) {
        const today = new Date().toISOString().split('T')[0];
        filterDateInput.value = today;
        console.log("Date set to:", today);
    }

    // Attach event listener to the date input so it updates when changed
    filterDateInput.addEventListener('change', loadMapData);

    // Initial load
    loadMapData();
});

async function loadMapData() {
    const selectedDate = document.getElementById('filterDate').value;
    console.log("Fetching data for:", selectedDate);
    
    // 2. Fetch data
    const { data, error } = await _supabase
        .from('engineer_tracking')
        .select('*')
        .eq('date', selectedDate);

    if (error) {
        console.error("Supabase Error:", error);
        return;
    }

    console.log("Data received:", data);

    // 3. Clear existing markers safely
    if (markers && markers.length > 0) {
        markers.forEach(m => map.removeLayer(m));
    }
    markers = [];
    
    let group = new L.featureGroup(); 

    // 4. Loop and Create Markers
    data.forEach(rec => {
        if(rec.latitude && rec.longitude) {
            // Color Logic
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

            const m = L.marker([rec.latitude, rec.longitude], { icon: customIcon })
                .bindPopup(`
                    <div style="font-family: sans-serif;">
                        <strong style="color:#667eea;">${rec.engineer}</strong><br>
                        <b>ID:</b> ${rec.employeeId || 'N/A'}<br>
                        <b>Time:</b> ${rec.loginTime || 'N/A'}<br>
                        <b>Status:</b> ${rec.status}<br>
                        <b>City:</b> ${rec.city}
                    </div>
                `);
            
            markers.push(m);
            m.addTo(group);
        }
    });

    // 5. Add to map and adjust view
    group.addTo(map);

    if (markers.length > 0) {
        map.fitBounds(group.getBounds().pad(0.2)); 
        console.log(`${markers.length} markers added to map.`);
    } else {
        map.setView([20.5937, 78.9629], 5);
        console.warn("No coordinates found for this date.");
    }
}
