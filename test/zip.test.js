import test from 'node:test';
import assert from 'node:assert/strict';
import { createAddonTemplate } from '../src/editor/template.js';
import { exportAddonZip, importAddonZip } from '../src/editor/zip.js';

test('addon ZIP export and import preserve package paths and UTF-8 source', async () => {
  const files = createAddonTemplate();
  files['content.js'] = "const greeting = 'Hello, café';\nconsole.log(greeting);\n";
  const config = JSON.parse(files['config.json']);
  const archive = await exportAddonZip(config, files);
  const restored = await importAddonZip(archive);
  assert.equal(restored.config.id, config.id);
  assert.deepEqual(Object.keys(restored.files).sort(), Object.keys(files).sort());
  assert.equal(restored.files['content.js'], files['content.js']);
  assert.equal(restored.files['assets/icon.svg'], files['assets/icon.svg']);
});

test('addon ZIP import rejects unrelated/corrupt data', async () => {
  await assert.rejects(() => importAddonZip(new Blob(['not a zip'])), /supported ZIP/);
});
