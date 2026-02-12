/**
 * Highlight Utilities
 * 
 * Simple syntax highlighting for code and variable display.
 */

/** Language definition for highlighting */
interface LanguageDefinition {
  keywords: string[];
  strings: RegExp;
  comments: RegExp;
  numbers: RegExp;
}

/** Basic language definitions */
const LANGUAGES: Record<string, LanguageDefinition> = {
  javascript: {
    keywords: [
      'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for',
      'while', 'class', 'extends', 'import', 'export', 'from', 'async',
      'await', 'try', 'catch', 'throw', 'new', 'this', 'true', 'false', 'null',
    ],
    strings: /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g,
    comments: /\/\/.*|\/\*[\s\S]*?\*\//g,
    numbers: /\b\d+\.?\d*\b/g,
  },
  typescript: {
    keywords: [
      'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for',
      'while', 'class', 'extends', 'import', 'export', 'from', 'async',
      'await', 'try', 'catch', 'throw', 'new', 'this', 'true', 'false', 'null',
      'type', 'interface', 'implements', 'readonly', 'private', 'public',
      'protected', 'static', 'abstract', 'as', 'is',
    ],
    strings: /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g,
    comments: /\/\/.*|\/\*[\s\S]*?\*\//g,
    numbers: /\b\d+\.?\d*\b/g,
  },
};

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Simple syntax highlight (returns HTML)
 */
export function highlight(code: string, language = 'typescript'): string {
  const lang = LANGUAGES[language] ?? LANGUAGES.typescript;
  let result = escapeHtml(code);

  // Highlight comments
  result = result.replace(lang.comments, '<span class="hl-comment">$&</span>');

  // Highlight strings
  result = result.replace(lang.strings, '<span class="hl-string">$&</span>');

  // Highlight numbers
  result = result.replace(lang.numbers, '<span class="hl-number">$&</span>');

  // Highlight keywords
  for (const keyword of lang.keywords) {
    const pattern = new RegExp(`\\b(${keyword})\\b`, 'g');
    result = result.replace(pattern, '<span class="hl-keyword">$1</span>');
  }

  return result;
}

/**
 * Highlight variables in a command string
 */
export function highlightVariables(text: string): string {
  const escaped = escapeHtml(text);
  // Match ${var} or $var patterns
  return escaped.replace(
    /(\$\{[^}]+\}|\$[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)/g,
    '<span class="variable-highlight">$1</span>'
  );
}

/**
 * Detect language from file extension
 */
export function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  
  const extensionMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
  };

  return extensionMap[ext] ?? 'plaintext';
}
