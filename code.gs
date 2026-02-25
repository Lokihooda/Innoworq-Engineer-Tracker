function doGet(e) {
  // Serve the HTML UI
  return HtmlService
    .createHtmlOutputFromFile('index')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    const sheet = SpreadsheetApp
      .openById('1aauwkCiG9LAT0FKgI4tA5C4g8cn2MCXHjh3aVSIMfKA') // your sheet ID
      .getSheetByName('Mar 26'); // tab name

    const p = e.parameter;
    Logger.log(JSON.stringify(p));

    sheet.appendRow([
      new Date(),                // Timestamp
      p['Engineer Name'] || '',
      p['Ticket ID'] || '',
      p['Employee ID'] || '',
      p['Date'] || '',
      p['Login Time'] || '',
      p['Shift'] || '',
      p['Status'] || '',
      p['Latitude'] || '',
      p['Longitude'] || '',
      p['CityState'] || '',
      p['Remarks'] || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log(err);
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
