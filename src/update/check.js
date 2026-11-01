const LATEST_MANIFEST_URL = 'https://raw.githubusercontent.com/mcv-s/extensify/HEAD/manifest.json';

export async function fetchLatestVersion({ fetchImpl = fetch } = {}) {
  const response = await fetchImpl(LATEST_MANIFEST_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not read the latest manifest (${response.status}).`);
  const manifest = await response.json();
  if (typeof manifest?.version !== 'string') throw new Error('The latest manifest does not contain a version.');
  return manifest.version;
}

export async function checkForUpdate({ fetchImpl = fetch, currentVersion = globalThis.chrome?.runtime?.getManifest?.().version } = {}) {
  if (!currentVersion) return null;
  const version = await fetchLatestVersion({ fetchImpl });
  return compareVersions(version, currentVersion) > 0 ? version : null;
}

export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (a.numbers[index] !== b.numbers[index]) return a.numbers[index] > b.numbers[index] ? 1 : -1;
  }
  return comparePrerelease(a.prerelease, b.prerelease);
}

function comparePrerelease(left, right) {
  if (left === right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  const a = left.split('.');
  const b = right.split('.');
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if (a[index] === undefined) return -1;
    if (b[index] === undefined) return 1;
    const aNumber = /^\d+$/.test(a[index]);
    const bNumber = /^\d+$/.test(b[index]);
    if (aNumber && bNumber && Number(a[index]) !== Number(b[index])) return Number(a[index]) > Number(b[index]) ? 1 : -1;
    if (aNumber !== bNumber) return aNumber ? -1 : 1;
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

function parseVersion(value) {
  const [core, prerelease = ''] = String(value).trim().replace(/^v/i, '').split('-', 2);
  const numbers = core.split('.').slice(0, 3).map(part => Number.parseInt(part, 10) || 0);
  while (numbers.length < 3) numbers.push(0);
  return { numbers, prerelease };
}
