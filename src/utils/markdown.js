export function renderMarkdown(markdown = '') {
  const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n');
  const output = [];
  let paragraph = [];
  let listType = '';
  let listItems = [];
  let codeLines = null;

  const flushParagraph = () => {
    if (paragraph.length) output.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (listItems.length) output.push(`<${listType}>${listItems.map(item => `<li>${inline(item)}</li>`).join('')}</${listType}>`);
    listItems = []; listType = '';
  };

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      flushParagraph(); flushList();
      if (codeLines) { output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`); codeLines = null; }
      else codeLines = [];
      continue;
    }
    if (codeLines) { codeLines.push(line); continue; }
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (!line.trim()) { flushParagraph(); flushList(); continue; }
    if (heading) { flushParagraph(); flushList(); const level = Math.min(heading[1].length + 1, 6); output.push(`<h${level}>${inline(heading[2])}</h${level}>`); continue; }
    if (unordered || ordered) {
      flushParagraph(); const nextType = ordered ? 'ol' : 'ul';
      if (listType && listType !== nextType) flushList();
      listType = nextType; listItems.push((unordered ?? ordered)[1]); continue;
    }
    flushList(); paragraph.push(line.trim());
  }
  if (codeLines) output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  flushParagraph(); flushList();
  return output.join('');
}

function inline(value) {
  const code = [];
  let result = escapeHtml(value).replace(/`([^`]+)`/g, (_match, text) => `\u0000${code.push(`<code>${text}</code>`) - 1}\u0000`);
  result = result.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/__(.+?)__/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/_(.+?)_/g, '<em>$1</em>').replace(/~~(.+?)~~/g, '<del>$1</del>');
  return result.replace(/\u0000(\d+)\u0000/g, (_match, index) => code[Number(index)]);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
}
