const { addon, settings, log } = window.extensify;

const BUILTIN_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "twclid",
  "igshid",
  "mc_cid",
  "mc_eid"
];

function getParameters() {
  const custom = String(settings.customParams ?? "")
    .split(/[\n,]+/)
    .map(parameter => parameter.trim().replace(/^\?+/, ""))
    .filter(parameter => /^[^&#=\s]+$/.test(parameter));
  return [...new Set([...BUILTIN_PARAMS, ...custom])];
}

function cleanUrl(value, parameters) {
  let url;
  try {
    url = value instanceof URL ? new URL(value.href) : new URL(String(value), window.location.href);
  } catch {
    return { url: null, removed: [] };
  }

  const removed = [];
  for (const parameter of [...url.searchParams.keys()]) {
    if (parameters.includes(parameter)) {
      url.searchParams.delete(parameter);
      if (!removed.includes(parameter)) removed.push(parameter);
    }
  }

  return { url, removed };
}

function showIndicator(removed) {
  if (!settings.showIndicator || !removed.length) return;

  const indicator = document.createElement("div");
  const shadow = indicator.attachShadow({ mode: "closed" });
  const label = document.createElement("span");
  label.textContent = `Removed: ${removed.join(", ")}`;
  shadow.innerHTML = `
    <style>
      :host { position: fixed; top: 12px; right: 12px; z-index: 2147483647; display: block; width: 16px; height: 16px; }
      .dot { width: 10px; height: 10px; margin: 3px; border: 2px solid rgba(255,255,255,.95); border-radius: 50%; background: #318cff; box-shadow: 0 0 0 1px rgba(18,58,112,.28), 0 0 12px rgba(49,140,255,.7); cursor: help; }
      .tooltip { position: absolute; top: 23px; right: 0; width: max-content; max-width: min(280px, calc(100vw - 24px)); padding: 9px 11px; border: 1px solid rgba(255,255,255,.14); border-radius: 8px; background: rgba(20,25,35,.96); box-shadow: 0 8px 24px rgba(0,0,0,.28); color: #f5f8ff; font: 12px/1.4 system-ui,sans-serif; opacity: 0; pointer-events: none; transform: translateY(-4px); transition: opacity 140ms ease 650ms, transform 140ms ease 650ms; }
      :host(:hover) .tooltip { opacity: 1; transform: translateY(0); }
    </style>
    <div class="dot" role="img" aria-label="Tracking parameters removed"></div>
    <div class="tooltip" role="tooltip"></div>
  `;
  shadow.querySelector(".tooltip").append(label);
  (document.body || document.documentElement).append(indicator);

  let timer = window.setTimeout(() => indicator.remove(), 6000);
  indicator.addEventListener("mouseenter", () => window.clearTimeout(timer));
  indicator.addEventListener("mouseleave", () => {
    timer = window.setTimeout(() => indicator.remove(), 300);
  });
}

function cleanCurrentUrl(parameters) {
  const { url, removed } = cleanUrl(window.location.href, parameters);
  if (!url || !removed.length) return;
  window.history.replaceState(window.history.state, "", url.href);
  showIndicator(removed);
}

function cleanLink(link, parameters) {
  if (!(link instanceof HTMLAnchorElement) || !link.href) return;
  const { url, removed } = cleanUrl(link.href, parameters);
  if (!url || !removed.length) return;
  link.href = url.href;
}

function patchHistory(parameters) {
  for (const method of ["pushState", "replaceState"]) {
    const original = window.history[method];
    window.history[method] = function(state, title, url) {
      if (url != null) {
        const cleaned = cleanUrl(url, parameters);
        if (cleaned.url && cleaned.removed.length) {
          url = cleaned.url.href;
          showIndicator(cleaned.removed);
        }
      }
      return original.call(this, state, title, url);
    };
  }
}

const parameters = getParameters();
cleanCurrentUrl(parameters);
patchHistory(parameters);
document.addEventListener("click", event => {
  const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (link) cleanLink(link, parameters);
}, true);
document.addEventListener("submit", event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  const action = form.action || window.location.href;
  const cleaned = cleanUrl(action, parameters);
  if (cleaned.url && cleaned.removed.length) form.action = cleaned.url.href;
}, true);
log.info("Clean URLs addon loaded", { addon: addon.id, version: addon.version, parameters });
