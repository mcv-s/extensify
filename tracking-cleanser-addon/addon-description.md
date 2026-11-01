# Clean URLs

Clean URLs removes common advertising and analytics parameters from page URLs, including `utm_*`, `fbclid`, `gclid`, and similar tracking values.

## How it works

The addon runs at the start of matching pages. It cleans the current address, removes tracking parameters from links before they are followed, and cleans URLs passed to in-page history navigation. The original page request has already reached the browser by the time an Extensify page script runs, so this addon cannot provide the original extension's network-level redirect behavior.

## Settings

- **Show clean-up indicator:** briefly show which parameters were removed.
- **Additional parameters:** add parameter names one per line or separated by commas.

Everything runs locally in the page. No URLs are sent anywhere.
