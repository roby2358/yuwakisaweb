// Parser — JSON facts + Markdown rules → a single program shape.
//
// Output:
//   {
//     declarations: [{ name, sort, value?, origin }],
//     assertions:   [{ source: string, node: Node }],
//   }
//
// AST shape is `{ value, children }` — the same shape MIAL uses. The
// node's value is a JS primitive for literals (number or boolean), a
// wrapped `{ string }` for string literals, or a bare string for symbol
// references and compound heads. Atoms have `children.length === 0`;
// compounds have `children.length > 0` and their `value` is the operator
// name. Sorts are not tagged onto literals — the compiler infers them
// from the JS type.
//
// The Markdown surface is MIAL-style: bullet nesting IS the tree. A
// bullet line's first whitespace-separated token is the node's value;
// any further tokens on that same line are flat children (compact
// form). Indented sub-bullets append deeper children. Backticks mark
// literals (numbers, booleans, "strings" or bare strings); unquoted
// tokens are symbols or operator names.
//
//   * =
//     * + alice bob carol
//     * total_age
//
// Declarations use the same bullet shape, with the sort as head and
// names as children (inline or nested):
//
//   * Int alice bob carol

export const node = (value, children) => ({ value, children: children || [] });

const SORTS = new Set(['Int', 'Real', 'Bool', 'String']);

// ── JSON half ─────────────────────────────────────────────────────────

const inferSort = (value) => {
  if (typeof value === 'boolean') return 'Bool';
  if (typeof value === 'string') return 'String';
  if (typeof value === 'number') return Number.isInteger(value) ? 'Int' : 'Real';
  throw new Error(`Cannot infer sort from JSON value: ${JSON.stringify(value)}`);
};

const qualify = (prefix, key) => prefix ? `${prefix}.${key}` : key;

const collectJSON = (value, prefix, typeHints, declarations) => {
  if (value === null) {
    throw new Error(`JSON null is not supported at '${prefix}'`);
  }
  if (Array.isArray(value)) {
    throw new Error(`JSON arrays are not supported in v1 (at '${prefix}')`);
  }
  if (typeof value === 'object') {
    const localHints = value._types || {};
    for (const key of Object.keys(localHints)) {
      if (!SORTS.has(localHints[key])) {
        throw new Error(`Unknown sort '${localHints[key]}' in _types at '${prefix}'`);
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === '_types') continue;
      collectJSON(child, qualify(prefix, key), localHints, declarations);
    }
    return;
  }
  const localKey = prefix.split('.').pop();
  const sort = typeHints[localKey] || inferSort(value);
  const inferred = inferSort(value);
  if (inferred !== sort && !(sort === 'Real' && inferred === 'Int')) {
    throw new Error(`Sort hint '${sort}' incompatible with value ${JSON.stringify(value)} at '${prefix}'`);
  }
  declarations.push({ name: prefix, sort, value });
};

export const parseJSON = (text) => {
  const trimmed = text.trim();
  if (!trimmed) return [];
  let data;
  try {
    data = JSON.parse(trimmed);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('JSON must be a top-level object');
  }
  const declarations = [];
  collectJSON(data, '', {}, declarations);
  return declarations;
};

// ── Markdown half ─────────────────────────────────────────────────────

const NUMBER_RE = /^-?\d+(\.\d+)?$/;
const IDENT_RE  = /^[A-Za-z_][A-Za-z0-9_.]*$/;

// Tokenize the content of a bullet line into a flat list of token strings.
// Backtick runs are preserved whole (including the backticks); everything
// else is whitespace-delimited.
const tokenize = (text) => {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === ' ' || ch === '\t') { i++; continue; }
    if (ch === '`') {
      const end = text.indexOf('`', i + 1);
      if (end === -1) throw new Error(`Unterminated backtick in '${text}'`);
      tokens.push(text.slice(i, end + 1));
      i = end + 1;
      continue;
    }
    let j = i;
    while (j < text.length && text[j] !== ' ' && text[j] !== '\t' && text[j] !== '`') j++;
    tokens.push(text.slice(i, j));
    i = j;
  }
  return tokens;
};

// Convert the content between the backticks into a literal node.
// Quoted strings (`"..."` / `'...'`) become String literals with the
// quotes stripped; `true`/`false` become Bool; numeric forms become
// Int or Real based on whether there's a decimal point; anything else
// is a String literal with the raw content (keeps `0.0.0.0/0`, `healthy`
// and similar unquoted string atoms working).
const parseBacktickLiteral = (inner) => {
  if (inner.length >= 2 &&
      ((inner.startsWith('"') && inner.endsWith('"')) ||
       (inner.startsWith("'") && inner.endsWith("'")))) {
    return node({ string: inner.slice(1, -1) });
  }
  if (inner === 'true')  return node(true);
  if (inner === 'false') return node(false);
  if (NUMBER_RE.test(inner)) return node(Number(inner));
  return node({ string: inner });
};

const parseToken = (tok) => {
  if (tok.length >= 2 && tok.startsWith('`') && tok.endsWith('`')) {
    return parseBacktickLiteral(tok.slice(1, -1));
  }
  return node(tok);
};

const BULLET_RE = /^(\s*)([-*])\s+(.*)$/;

const parseBullet = (line) => {
  const m = line.match(BULLET_RE);
  if (!m) throw new Error(`Malformed bullet: '${line}'`);
  const leading = m[1].replace(/\t/g, '  ');
  const indent = Math.floor(leading.length / 2);
  const content = m[3];
  const tokens = tokenize(content);
  if (tokens.length === 0) throw new Error(`Empty bullet: '${line}'`);
  const head = parseToken(tokens[0]);
  if (tokens.length > 1) head.children = tokens.slice(1).map(parseToken);
  return { indent, node: head };
};

const isBulletLine = (line) => BULLET_RE.test(line);
const isSectionHeading = (line) => /^#+\s+/.test(line);
const sectionName = (line) => line.replace(/^#+\s*/, '').trim().toLowerCase();

// Walk a slice of lines and build the tree of top-level bullet roots.
// Each root carries its raw source block so an unsat core can render the
// assertion back as the user wrote it.
const buildBulletTrees = (lines, start, end) => {
  const roots = [];
  const stack = []; // [{ indent, node }]
  let currentRoot = null;

  for (let i = start; i < end; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (!isBulletLine(line)) continue;
    const { indent, node: n } = parseBullet(line);

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop();

    if (stack.length === 0) {
      currentRoot = { node: n, sourceLines: [line] };
      roots.push(currentRoot);
    } else {
      stack[stack.length - 1].node.children.push(n);
      currentRoot.sourceLines.push(line);
    }
    stack.push({ indent, node: n });
  }
  return roots;
};

const parseDeclareRoot = (root) => {
  const sort = root.node.value;
  if (typeof sort !== 'string' || !SORTS.has(sort)) {
    throw new Error(`Declaration must start with a sort (Int/Real/Bool/String), got '${JSON.stringify(sort)}'`);
  }
  if (root.node.children.length === 0) {
    throw new Error(`Declaration '${sort}' has no names`);
  }
  const decls = [];
  for (const c of root.node.children) {
    if (typeof c.value !== 'string' || !IDENT_RE.test(c.value)) {
      throw new Error(`Invalid declaration name '${JSON.stringify(c.value)}'`);
    }
    if (c.children.length > 0) {
      throw new Error(`Declaration name '${c.value}' must be a bare symbol`);
    }
    decls.push({ name: c.value, sort });
  }
  return decls;
};

export const parseMarkdown = (text) => {
  const declarations = [];
  const assertions = [];
  let checkCount = 0;

  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!isSectionHeading(line)) { i++; continue; }
    const name = sectionName(line);
    if (!['declare', 'assert', 'check'].includes(name)) {
      throw new Error(`Unknown section heading '${name}' — expected declare, assert, or check`);
    }
    const sectionStart = i + 1;
    let sectionEnd = sectionStart;
    while (sectionEnd < lines.length && !isSectionHeading(lines[sectionEnd])) sectionEnd++;

    const roots = buildBulletTrees(lines, sectionStart, sectionEnd);

    if (name === 'declare') {
      for (const r of roots) declarations.push(...parseDeclareRoot(r));
    } else if (name === 'assert') {
      for (const r of roots) {
        assertions.push({ source: r.sourceLines.join('\n'), node: r.node });
      }
    } else if (name === 'check') {
      checkCount++;
      if (checkCount > 1) throw new Error('Multiple # check sections are not supported in v1');
      if (roots.length > 0) {
        throw new Error('# check MUST be empty in v1 (the check is over all asserts)');
      }
    }

    i = sectionEnd;
  }

  if (checkCount === 0) throw new Error('Missing # check section');
  return { declarations, assertions };
};

// ── Combine ───────────────────────────────────────────────────────────

export const parseProgram = (jsonText, markdownText) => {
  const jsonDecls = parseJSON(jsonText);
  const md = parseMarkdown(markdownText);

  const byName = new Map();
  for (const d of jsonDecls) byName.set(d.name, { ...d, origin: 'json' });
  for (const d of md.declarations) {
    if (byName.has(d.name)) {
      throw new Error(`Symbol '${d.name}' declared in both JSON and Markdown`);
    }
    byName.set(d.name, { ...d, origin: 'markdown' });
  }

  return {
    declarations: [...byName.values()],
    assertions: md.assertions,
  };
};
