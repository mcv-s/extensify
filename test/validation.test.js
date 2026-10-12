import test from 'node:test';
import assert from 'node:assert/strict';
import { createAddonTemplate } from '../src/editor/template.js';
import { matchesUrl, normalizePath, validatePackage, validateSettings, validateSvg } from '../src/addons/validation.js';

test('default addon template passes package validation', () => {
  const files=createAddonTemplate();
  assert.equal(Object.hasOwn(files,'README.md'),false);
  const result=validatePackage(JSON.parse(files['config.json']),files);
  assert.equal(result.valid,true,result.errors.join('\n'));
});

test('Phosphor icon names are free-form and do not require a bundled icon registry', () => {
  const files=createAddonTemplate();
  const config=JSON.parse(files['config.json']);
  config.logo.name='custom-icon-name-not-in-a-registry';
  assert.equal(validatePackage(config,files).valid,true);
});

test('package validation identifies missing config, permission, and declared entry files', () => {
  const files=createAddonTemplate();delete files['config.json'];delete files['content.js'];
  const config=JSON.parse(createAddonTemplate()['config.json']);config.permissions=[];
  const result=validatePackage(config,files);
  assert.match(result.errors.join(' '),/Missing config\.json/);
  assert.match(result.errors.join(' '),/contentScript permission/);
  assert.match(result.errors.join(' '),/entry-point file not found/);
});

test('package validation parses config.json and matches its stable ID', () => {
  const files = createAddonTemplate(); const config = JSON.parse(files['config.json']);
  files['config.json'] = '{';
  assert.match(validatePackage(config, files).errors.join(' '), /config\.json is not valid JSON/);
  files['config.json'] = JSON.stringify({ ...config, id: 'other-addon' });
  assert.match(validatePackage(config, files).errors.join(' '), /ID does not match/);
});

test('settings schema validates choices and bounds', () => {
  assert.deepEqual(validateSettings({theme:{type:'select'},count:{type:'number',min:4,max:2}}),['Select setting “theme” needs choices.','Setting “count” has min greater than max.']);
});

test('settings schema accepts display names and info text', () => {
  assert.deepEqual(validateSettings({
    sideBarKeybind: { type: 'string', default: 'Ctrl+B', displayName: 'Keybind to open sidebar:', info: 'Shortcut help.' }
  }), []);
  assert.match(validateSettings({ setting: { type: 'string', displayName: 42, info: true } }).join(' '), /displayName.*info/);
});

test('paths reject traversal and normalize separators', () => {
  assert.equal(normalizePath('assets\\icon.svg'),'assets/icon.svg');
  assert.throws(()=>normalizePath('../escape.js'),/Unsafe file path/);
  assert.throws(()=>normalizePath('/root.js'),/Unsafe file path/);
});

test('SVG validation rejects active and remote content', () => {
  assert.equal(validateSvg('<svg xmlns="http://www.w3.org/2000/svg"><path fill="#fff"/></svg>'),true);
  assert.throws(()=>validateSvg('<svg><script>alert(1)</script></svg>'),/unsafe content/);
  assert.throws(()=>validateSvg('<svg><image href="https://example.com/x.png"/></svg>'),/unsafe content/);
});

test('URL match patterns support scheme and subdomain wildcards', () => {
  assert.equal(matchesUrl('https://*.example.com/*','https://shop.example.com/product'),true);
  assert.equal(matchesUrl('https://*.example.com/*','http://shop.example.com/product'),false);
  assert.equal(matchesUrl('https://example.com/articles/*','https://example.com/help'),false);
  assert.equal(matchesUrl('<all_urls>','https://example.com/'),true);
});
