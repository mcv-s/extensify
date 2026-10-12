import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../src/utils/markdown.js';

test('Markdown renderer preserves fenced code and its language class', () => {
  const html=renderMarkdown('```js\nconst greeting = "<hello>";\n```',{headingOffset:0});
  assert.match(html,/<pre><code class="language-js">const greeting = &quot;&lt;hello&gt;&quot;;<\/code><\/pre>/);
});

test('Markdown heading offset keeps documentation sections suitable for generated navigation', () => {
  assert.match(renderMarkdown('## Addon settings',{headingOffset:0}),/<h2>Addon settings<\/h2>/);
  assert.match(renderMarkdown('# Description'),/<h2>Description<\/h2>/);
});
