const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyY4mnUT05CdI9ATpz0cNKFho7-2pXWXYwOQxWGN0hPLKX_petHXuLHDi5cQes6FDJYlw/exec';

let currentLocation = {
  latitude: null,
  longitude: null,
  address: null,
  city: null,
  state: null
};

// Get current location on page load
window.addEventListener('DOMContentLoaded', () => {
  getCurrentLocation();
});

function getCurrentLocation() {
  const latField = document.querySelector('input[name="latitude"]');
  const lngField = document.querySelector('input[name="longitude"]');
  
  if ('geolocation' in navigator) {
    // Show loading state
    latField.value = 'Getting location...';
    lngField.value = 'Getting location...';
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        currentLocation.latitude = position.coords.latitude;
        currentLocation.longitude = position.coords.longitude;
        
        latField.value = currentLocation.latitude.toFixed(6);
        lngField.value = currentLocation.longitude.toFixed(6);
        
        // Get address, city, and state from coordinates using reverse geocoding
        try {
          const locationData = await getAddressFromCoords(currentLocation.latitude, currentLocation.longitude);
          currentLocation.address = locationData.address;
          currentLocation.city = locationData.city;
          currentLocation.state = locationData.state;
          console.log('Location captured:', locationData);
        } catch (error) {
          console.error('Error getting address:', error);
          currentLocation.address = `${currentLocation.latitude}, ${currentLocation.longitude}`;
          currentLocation.city = 'Unknown';
          currentLocation.state = 'Unknown';
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        latField.value = '28.5355';
        lngField.value = '77.3910';
        alert('Could not get your location. Please enable location services or enter manually.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  } else {
    alert('Geolocation is not supported by your browser.');
    latField.value = '28.5355';
    lngField.value = '77.3910';
  }
}

// Reverse geocoding using Nominatim (OpenStreetMap)
async function getAddressFromCoords(lat, lng) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    const data = await response.json();
    
    // Extract city and state from address components
    const addressComponents = data.address || {};
    
    const city = addressComponents.city || 
                 addressComponents.town || 
                 addressComponents.village || 
                 addressComponents.municipality || 
                 addressComponents.county || 
                 'Unknown';
    
    const state = addressComponents.state || 
                  addressComponents.province || 
                  addressComponents.region || 
                  'Unknown';
    
    return {
      address: data.display_name || `${lat}, ${lng}`,
      city: city,
      state: state
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return {
      address: `${lat}, ${lng}`,
      city: 'Unknown',
      state: 'Unknown'
    };
  }
}

// Form submission
document.getElementById('trackingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const messageDiv = document.getElementById('message');
  const form = e.target;
  const formData = new FormData(form);
  
  // Update location one more time before submitting
  if (currentLocation.latitude && currentLocation.longitude) {
    formData.set('latitude', currentLocation.latitude);
    formData.set('longitude', currentLocation.longitude);
  }
  
  // Create data object with all fields
  const data = {
    
    
    : formData.get('engineer'),
    ticketId: formData.get('ticketId'),
        employeeId: formData.get('employeeId'),
    date: formData.get('date'),
    loginTime: formData.get('loginTime'),
    shift: formData.get('shift'),
    status: formData.get('status'),
    latitude: formData.get('latitude'),
    longitude: formData.get('longitude'),
    location: currentLocation.address || `${formData.get('latitude')}, ${formData.get('longitude')}`,
    city: currentLocation.city || 'Unknown',
    state: currentLocation.state || 'Unknown',
    remarks: formData.get('remarks') || 'N/A',
    timestamp: new Date().toISOString()
  };

  try {
    messageDiv.textContent = '⏳ Submitting data...';
    messageDiv.className = 'show';
    
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    messageDiv.textContent = '✅ Location submitted successfully!';
    messageDiv.className = 'show success';
    
    // Don't reset the form completely, just clear text fields
    form.querySelector('input[name="engineer"]').value = '';
    form.querySelector('input[name="ticketId"]').value = '';
    form.querySelector('select[name="shift"]').value = '';
    form.querySelector('select[name="status"]').value = '';
    form.querySelector('textarea[name="remarks"]').value = '';
    
    // Refresh location
    getCurrentLocation();
    
    // Hide message after 3 seconds
    setTimeout(() => {
      messageDiv.className = '';
    }, 3000);
    
  } catch (error) {
    messageDiv.textContent = '❌ Error: ' + error.message;
    messageDiv.className = 'show error';
  }
});
