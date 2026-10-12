// The full application needs extension storage and browser APIs. Public docs
// and privacy content can render as standalone pages on ordinary web origins.
const publicContent = /\/(?:docs|privacy)\.html$/i.test(location.pathname);
if (!publicContent && !/^(?:chrome-extension|extension):$/i.test(location.protocol)) {
  location.replace(new URL('quickstart.html', location.href).href);
}
