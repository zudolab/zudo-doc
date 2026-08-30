/**
 * parse-frontmatter.js
 *
 * Splits a raw MDX/Markdown string into its YAML frontmatter block and body.
 * This is the helper referenced from the "Custom Components" guide — it is
 * intentionally dependency-free so it can run both at build time (Node) and
 * inside a client island.
 */

const FENCE = '---';
const FENCE_RE = /^---[ \t]*\r?\n/;

/**
 * @typedef {Object} ParsedDocument
 * @property {Record<string, unknown>} data   Parsed frontmatter fields
 * @property {string} body                    Markdown body without the fence
 * @property {boolean} hasFrontmatter          Whether a fence was found
 */

/**
 * Parse a document string.
 *
 * @param {string} source  Raw file contents
 * @param {{ strict?: boolean }} [options]
 * @returns {ParsedDocument}
 */
export function parseFrontmatter(source, options = {}) {
  const { strict = false } = options;

  if (!FENCE_RE.test(source)) {
    return { data: {}, body: source, hasFrontmatter: false };
  }

  const end = source.indexOf(`\n${FENCE}`, FENCE.length);
  if (end === -1) {
    if (strict) throw new Error('Unterminated frontmatter block');
    return { data: {}, body: source, hasFrontmatter: false };
  }

  const yaml = source.slice(FENCE.length, end).replace(/^\r?\n/, '');
  const body = source.slice(end + FENCE.length + 1).replace(/^\r?\n/, '');

  return { data: parseYamlSubset(yaml), body, hasFrontmatter: true };
}

/**
 * A deliberately tiny YAML subset: `key: scalar`, `key: [a, b]`, and
 * block lists under a key. Anything fancier should go through a real
 * YAML parser — this exists so the client island stays small.
 */
export function parseYamlSubset(yaml) {
  const data = {};
  let currentKey = null;

  for (const rawLine of yaml.split('\n')) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line || line.startsWith('#')) continue;

    const listItem = /^\s+-\s+(.*)$/.exec(line);
    if (listItem && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(coerce(listItem[1]));
      continue;
    }

    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;

    const [, key, value] = kv;
    currentKey = key;

    if (value === '') {
      data[key] = null; // block list or nested map follows
    } else if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value.slice(1, -1).split(',').map(v => coerce(v.trim())).filter(v => v !== '');
    } else {
      data[key] = coerce(value);
    }
  }

  return data;
}

function coerce(value) {
  const unquoted = value.replace(/^(['"])(.*)\1$/, '$2');
  if (unquoted !== value) return unquoted;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

export default parseFrontmatter;
