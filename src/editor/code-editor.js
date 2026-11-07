const vsPath = 'src/vendor/min/vs';
let monacoPromise;

export function createCodeEditor(root, value, { onChange = () => {}, onCursor = () => {}, language = 'plaintext', fileName = 'untitled', engine = 'vscode' } = {}) {
  if (engine === 'classic') return createClassicEditor(root, value, { onChange, onCursor });
  root.replaceChildren();
  let currentValue = value;
  let currentLanguage = language;
  let editor;
  let model;
  let disposed = false;
  let themeObserver;

  loadMonaco().then(monaco => {
    if (disposed) return;
    model = monaco.editor.createModel(currentValue, currentLanguage, monaco.Uri.from({ scheme: 'inmemory', path: `/${fileName}` }));
    editor = monaco.editor.create(root, {
      model,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: true,
      wordWrap: 'off',
      glyphMargin: true,
      folding: true,
      foldingStrategy: 'indentation',
      showFoldingControls: 'mouseover',
      lineNumbersMinChars: 2,
      lineDecorationsWidth: 4,
      fontFamily: "Consolas, 'Courier New', monospace",
      fontSize: 13,
      lineHeight: 20,
      tabSize: 2,
      insertSpaces: true,
      renderLineHighlight: 'line',
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true, indentation: true },
      padding: { top: 12, bottom: 12 },
      quickSuggestions: true,
      suggestOnTriggerCharacters: true,
      suggest: { preview: true, showWords: true, snippetsPreventQuickSuggestions: false },
      parameterHints: { enabled: true, cycle: true },
      hover: { enabled: true, delay: 350 },
      acceptSuggestionOnEnter: 'on',
      tabCompletion: 'on',
      wordBasedSuggestions: 'matchingDocuments'
    });
    const updateTheme = () => monaco.editor.setTheme(document.documentElement.dataset.theme === 'light' ? 'vs' : 'vs-dark');
    updateTheme();
    themeObserver = new MutationObserver(updateTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    editor.onDidChangeModelContent(() => {
      currentValue = editor.getValue();
      onChange(currentValue);
    });
    editor.onDidChangeCursorPosition(({ position }) => onCursor({ line: position.lineNumber, column: position.column }));
    const position = editor.getPosition();
    if (position) onCursor({ line: position.lineNumber, column: position.column });
  }).catch(error => {
    if (!disposed) mountFallback(root, currentValue, error, nextValue => {
      currentValue = nextValue;
      onChange(nextValue);
    });
  });

  return {
    getValue: () => editor?.getValue() ?? currentValue,
    setLanguage(nextLanguage) {
      currentLanguage = nextLanguage;
      if (model) monacoPromise.then(monaco => monaco.editor.setModelLanguage(model, currentLanguage));
    },
    focus: () => editor?.focus(),
    destroy() {
      disposed = true;
      themeObserver?.disconnect();
      editor?.dispose();
      model?.dispose();
      root.replaceChildren();
    }
  };
}

function createClassicEditor(root, value, { onChange, onCursor }) {
  root.innerHTML = '<div class="source-editor"><div class="source-gutter" aria-hidden="true"></div><textarea class="source-input" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Current addon file"></textarea></div>';
  const input = root.querySelector('.source-input');
  const gutter = root.querySelector('.source-gutter');
  input.value = value;
  const update = () => {
    const lines = input.value.split('\n').length;
    gutter.innerHTML = Array.from({ length: lines }, (_, index) => `<span>${index + 1}</span>`).join('');
    const before = input.value.slice(0, input.selectionStart).split('\n');
    onCursor({ line: before.length, column: before.at(-1).length + 1 });
  };
  input.addEventListener('input', () => { update(); onChange(input.value); });
  input.addEventListener('keyup', update);
  input.addEventListener('click', update);
  input.addEventListener('scroll', () => { gutter.scrollTop = input.scrollTop; });
  input.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    input.setRangeText('  ', input.selectionStart, input.selectionEnd, 'end');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  update();
  return { getValue: () => input.value, setLanguage() {}, focus: () => input.focus(), destroy: () => root.replaceChildren() };
}

function loadMonaco() {
  if (globalThis.monaco?.editor) return Promise.resolve(globalThis.monaco);
  if (monacoPromise) return monacoPromise;

  monacoPromise = new Promise((resolve, reject) => {
    const configure = () => {
      const base = chrome.runtime.getURL(vsPath);
      globalThis.MonacoEnvironment = { globalAPI: true };
      globalThis.require.config({ paths: { vs: base } });
      globalThis.require(['vs/editor/editor.main'], () => resolve(globalThis.monaco), reject);
    };

    if (globalThis.require?.config) {
      configure();
      return;
    }

    const loader = document.createElement('script');
    loader.src = chrome.runtime.getURL(`${vsPath}/loader.js`);
    loader.onload = configure;
    loader.onerror = () => reject(new Error('Could not load the local Monaco AMD loader.'));
    document.head.append(loader);
  });
  return monacoPromise;
}

function mountFallback(root, value, error, onChange) {
  console.error('Monaco could not initialize; using a plain text editor.', error);
  const input = document.createElement('textarea');
  input.className = 'source-input';
  input.spellcheck = false;
  input.autocapitalize = 'off';
  input.autocomplete = 'off';
  input.setAttribute('aria-label', 'Current addon file');
  input.value = value;
  input.addEventListener('input', () => onChange(input.value));
  root.replaceChildren(input);
}
