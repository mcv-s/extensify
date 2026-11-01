import test from 'node:test';
import assert from 'node:assert/strict';
import { checkForUpdate, compareVersions, fetchLatestVersion } from '../src/update/check.js';

test('version comparison handles patch and prerelease ordering', () => {
  assert.equal(compareVersions('2.1.0', '2.0.9'), 1);
  assert.equal(compareVersions('2.0.0-beta.2', '2.0.0-beta.10'), -1);
  assert.equal(compareVersions('2.0.0', '2.0.0-rc.1'), 1);
});

test('update check returns the remote version only when it is newer', async () => {
  const fetchImpl = async () => ({ ok: true, async json() { return { version: '2.1.0' }; } });
  assert.equal(await checkForUpdate({ fetchImpl, currentVersion: '2.0.0' }), '2.1.0');
  assert.equal(await checkForUpdate({ fetchImpl, currentVersion: '2.1.0' }), null);
});

test('latest manifest reader returns the published version', async () => {
  const fetchImpl = async () => ({ ok: true, async json() { return { version: '2.2.0' }; } });
  assert.equal(await fetchLatestVersion({ fetchImpl }), '2.2.0');
});

test('update check fails quietly when the request fails', async () => {
  const fetchImpl = async () => ({ ok: false, status: 503 });
  await assert.rejects(() => checkForUpdate({ fetchImpl, currentVersion: '2.0.0' }), /Could not read the latest manifest/);
});
