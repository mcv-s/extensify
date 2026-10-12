// Extension pages run on chrome-extension:// (Chromium) or extension:// in
// compatible shells. The repository's ordinary web pages are a setup landing page.
if (!/^(?:chrome-extension|extension):$/i.test(location.protocol)) {
  location.replace(new URL('quickstart.html', location.href).href);
}
