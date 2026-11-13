import { getState } from './src/storage/state.js';

const content = document.getElementById('content');

function showError(message) {
    content.textContent = message;
    document.title = 'Extensify - Error';
}

function parseHash() {
    const hash = location.hash.slice(1);
    const separator = hash.indexOf('/');

    if (separator < 1) return null;

    try {
        return {
            addonId: decodeURIComponent(hash.slice(0, separator)),
            pagePath: decodeURIComponent(hash.slice(separator + 1))
        };
    } catch {
        return null;
    }
}

function normalizePagePath(path) {
    if (typeof path !== 'string' || !path) return null;

    if (
        path.startsWith('/') ||
        path.includes('\\') ||
        path.split('/').some(part => !part || part === '.' || part === '..')
    ) {
        return null;
    }

    if (!path.toLowerCase().endsWith('.html')) {
        path += '.html';
    }

    return path;
}

function makePageUrl(path) {
    const displayPath = path.replace(/\.html$/i, '');

    const encodedPath = displayPath
        .split('/')
        .map(encodeURIComponent)
        .join('/');

    return `${location.pathname}${location.search}#${encodeURIComponent(addon.id)}/${encodedPath}`;
}

const route = parseHash();

if (!route?.addonId || !route.pagePath) {
    showError('Invalid addon page URL.');
    throw new Error('Invalid addon page URL.');
}

const initialPagePath = normalizePagePath(route.pagePath);

if (!initialPagePath) {
    showError('Invalid addon page path.');
    throw new Error('Invalid addon page path.');
}

const state = await getState();
const addon = state.addons?.[route.addonId];

if (!addon) {
    showError('Addon not found.');
    throw new Error('Addon not found.');
}

const frame = document.createElement('iframe');


frame.title = addon.config?.name ?? addon.id;
frame.setAttribute('sandbox', 'allow-scripts');

content.replaceChildren(frame);

function loadPage(path) {
    const pagePath = normalizePagePath(path);

    if (!pagePath) {
        console.warn('[Extensify] Invalid addon page path:', path);
        return;
    }

    const html = addon.files?.[pagePath];

    if (typeof html !== 'string') {
        console.warn('[Extensify] Addon page not found:', pagePath);
        return;
    }

    document.title = `${addon.config?.name ?? addon.id} - ${pagePath.replace(/\.html$/i, '')}`;

    frame.contentWindow.postMessage({
        type: 'EXTENSIFY_PAGE_LOAD',

        addon: {
            id: addon.id,
            version: addon.version,
            settings: addon.settings ?? {},
            permissions: addon.config?.permissions ?? [],
            source: ''
        },

        page: {
            pagePath,
            html,
            files: addon.files ?? {}
        }
    }, '*');
}

function navigateToPage(path) {
    const pagePath = normalizePagePath(path);

    if (!pagePath || typeof addon.files?.[pagePath] !== 'string') {
        console.warn('[Extensify] Cannot navigate to addon page:', path);
        return;
    }

    // Update the real browser URL and create a history entry.
    history.pushState({}, '', makePageUrl(pagePath));

    // Load the new page without reloading the extension page.
    loadPage(pagePath);
}

// Handle messages from the sandbox.
window.addEventListener('message', async event => {
    if (event.source !== frame.contentWindow) return;

    const message = event.data;

    // Addon page navigation.
    if (message?.type === 'EXTENSIFY_PAGE_NAVIGATE') {
        navigateToPage(message.pagePath);
        return;
    }

    // Existing background API bridge.
    if (message?.type !== 'EXTENSIFY_BACKGROUND_API') return;

    const { requestId, method, args } = message;

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'EXTENSIFY_BACKGROUND_API',
            addonId: addon.id,
            method,
            args
        });

        frame.contentWindow?.postMessage({
            type: 'EXTENSIFY_BACKGROUND_API_RESULT',
            requestId,
            response
        }, '*');

    } catch (error) {
        frame.contentWindow?.postMessage({
            type: 'EXTENSIFY_BACKGROUND_API_RESULT',
            requestId,
            response: { error: error.message }
        }, '*');
    }
});

// Handle browser Back and Forward.
window.addEventListener('popstate', () => {
    const currentRoute = parseHash();

    if (!currentRoute || currentRoute.addonId !== addon.id) return;

    loadPage(currentRoute.pagePath);
});

// Load the initial page after the sandbox is ready.
frame.addEventListener('load', () => {
    loadPage(initialPagePath);
}, { once: true });

frame.src = chrome.runtime.getURL('src/background/sandbox.html');