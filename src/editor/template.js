export function createAddonTemplate() {
  const config = {
    manifestVersion: 1, id: 'my-first-addon', title: 'My First Addon', version: '1.0.0', author: { name: 'Your name' }, logo: { type: 'icon', name: 'PuzzlePiece', color: '#3ecf8e' },
    permissions: ['contentScript', 'storage', 'settings'],
    contentScripts: [{ matches: ['https://example.com/*'], js: ['content.js'], css: ['content.css'], runAt: 'document_idle', allFrames: false }],
    env: { greeting: { type: 'string', displayName: 'Greeting', info: 'Text shown by this addon.', default: 'Hello from Extensify', visibility: true }, enabled: { type: 'boolean', displayName: 'Show greeting', default: true, visibility: true }, internalMode: { type: 'string', default: 'standard', visibility: false } }
  };
  return {
    'config.json': JSON.stringify(config, null, 2),
    'addon-description.md': '# My First Addon\n\nDescribe what this addon does, how it works, and what someone should expect when they enable it. Use Markdown for headings, lists, links, and code examples.\n',
    'content.js': "if (extensify.settings.enabled) {\n  extensify.log.info(extensify.settings.greeting);\n}\n",
    'content.css': '/* Styles are added only on sites declared in config.json. */\n'
  };
}
