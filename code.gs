function getCity(lat, lng) {
  var apiKey = "AIzaSyCUWijglERv7D_3u2hAKyIEHWJlHyeaeOc"; // replace with your real API key
  var url =
    "https://maps.googleapis.com/maps/api/geocode/json?latlng=" +
    lat + "," + lng + "&key=" + apiKey;

  var response = UrlFetchApp.fetch(url);
  var json = JSON.parse(response.getContentText());

  if (!json.results || json.results.length === 0) {
    return "City not found";
  }

  var components = json.results[0].address_components;
  for (var i = 0; i < components.length; i++) {
    var comp = components[i];
    if (comp.types.indexOf("locality") !== -1) { // locality = city
      return comp.long_name;
    }
  }

  return "City not found";
}

function doGet(e) {
  const t = HtmlService.createTemplateFromFile('index'); // HTML file name
  t.scriptUrl = ScriptApp.getService().getUrl();         // active Web App URL
  return t
    .evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    const sheet = SpreadsheetApp
      .openById('1aauwkCiG9LAT0FKgI4tA5C4g8cn2MCXHjh3aVSIMfKA') // Sheet ID
      .getSheetByName('Mar 26');                               // Tab name

    const p = e.parameter;

    var lat = p['Latitude'] || '';
    var lng = p['Longitude'] || '';

    // compute city from lat/lng only (nothing from form)
    var city = (lat && lng) ? getCity(lat, lng) : 'City not found';

    sheet.appendRow([
      new Date(),                 // Timestamp
      p['Engineer Name'] || '',
      p['Ticket ID'] || '',
      p['Employee ID'] || '',
      p['Date'] || '',
      p['Login Time'] || '',
      p['Shift'] || '',
      p['Status'] || '',
      lat,
      lng,
      city,                       // city stored only in sheet
      p['Remarks'] || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
