export function createCodeEditor(root, value, { onChange = () => {}, onCursor = () => {} } = {}) {
  root.innerHTML = '<div class="source-editor"><div class="source-gutter" aria-hidden="true"></div><textarea class="source-input" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Current addon file"></textarea></div>';
  const input = root.querySelector('.source-input'); const gutter = root.querySelector('.source-gutter');
  input.value = value;
  const update = () => {
    const lines = input.value.split('\n').length;
    gutter.innerHTML = Array.from({ length: lines }, (_, index) => `<span>${index + 1}</span>`).join('');
    const before = input.value.slice(0, input.selectionStart).split('\n');
    onCursor({ line: before.length, column: before.at(-1).length + 1 });
  };
  input.addEventListener('input', () => { update(); onChange(input.value); });
  input.addEventListener('keyup', update); input.addEventListener('click', update);
  input.addEventListener('scroll', () => { gutter.scrollTop = input.scrollTop; });
  input.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const start = input.selectionStart; const end = input.selectionEnd;
    input.setRangeText('  ', start, end, 'end'); input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  update();
  return { getValue: () => input.value, setLanguage() {}, focus: () => input.focus(), destroy: () => root.replaceChildren() };
}
