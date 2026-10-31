import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUserScript } from '../src/runtime/user-script.js';

test('user-script instances track and stop addon listeners and timers on replacement', () => {
  const code = buildUserScript({ id:'sample-addon', version:'1.0.0', settings:{}, config:{ permissions:[] }, files:{} }, `document.addEventListener('keydown', handler);\nsetInterval(handler, 1000);`, [], 'sample-addon-0');
  assert.match(code, /__extensifyRuntimeManager/);
  assert.match(code, /removeEventListener\(record\.type, record\.wrapped, record\.options\)/);
  assert.match(code, /globalThis\.clearInterval\(id\)/);
  assert.match(code, /runtimeManager\.stop\(runtimeInstance\)/);
});
