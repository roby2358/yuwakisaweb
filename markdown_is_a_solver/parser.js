// Parser — JSON facts + Markdown rules → a single program shape
//
// Output shape:
//   {
//     declarations: [{ name, sort, value? }],       // JSON-sourced and Markdown-declared constants
//     assertions:   [{ source: string, node: Node }], // one per top-level `assert` bullet;
//                                                     // `source` preserves the original text so
//                                                     // the solver's unsat core can name the rule.
//   }
//
// Nodes use the uniform { value, children } shape shared by both parsers.
// A Node is either a constant reference, a literal, or a compound term.
//
//   { value: { name: 'port' }, children: [] }        // symbol reference
//   { value: { lit: 443, sort: 'Int' }, children: [] }  // literal
//   { value: { op: 'and' }, children: [...] }        // compound

export const node = (value, children) => ({ value, children });

export const isSymbol  = (n) => n && typeof n.value === 'object' && 'name' in n.value;
export const isLiteral = (n) => n && typeof n.value === 'object' && 'lit'  in n.value;
export const isCompound = (n) => n && typeof n.value === 'object' && 'op'  in n.value;

// ── JSON half ─────────────────────────────────────────────────────────

const SORTS = new Set(['Int', 'Real', 'Bool', 'String']);

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

const LITERAL_RE = /^`([^`]*)`$/;
const NUMBER_RE  = /^-?\d+(\.\d+)?$/;
const IDENT_RE   = /^[A-Za-z_][A-Za-z0-9_.]*$/;
// Operators include alphabetic names (and, or, ite, mod, distinct, …) as
// well as the symbolic SMT operators used in prefix form: =(a,b), +(…), etc.
const OP_RE      = /^(?:[A-Za-z_][A-Za-z0-9_]*|=|\+|-|\*|\/|<=?|>=?)$/;

// Split by commas at depth 0, respecting parens and backtick literals.
const splitArgs = (text) => {
  const parts = [];
  let current = '';
  let depth = 0;
  let inBacktick = false;
  for (const ch of text) {
    if (ch === '`') { inBacktick = !inBacktick; current += ch; }
    else if (!inBacktick && ch === '(') { depth++; current += ch; }
    else if (!inBacktick && ch === ')') { depth--; current += ch; }
    else if (ch === ',' && !inBacktick && depth === 0) { parts.push(current); current = ''; }
    else current += ch;
  }
  parts.push(current);
  return parts;
};

// Parse a Bool or numeric literal from a raw string. Returns null if not recognized.
const parsePrimitiveLiteral = (raw) => {
  if (raw === 'true')  return node({ lit: true,  sort: 'Bool' }, []);
  if (raw === 'false') return node({ lit: false, sort: 'Bool' }, []);
  if (NUMBER_RE.test(raw)) {
    const num = Number(raw);
    return node({ lit: num, sort: Number.isInteger(num) ? 'Int' : 'Real' }, []);
  }
  return null;
};

// Parse the content of a backtick-quoted token. Strings that are not a
// recognized primitive become String literals.
const parseLiteral = (raw) => {
  const prim = parsePrimitiveLiteral(raw);
  if (prim) return prim;
  return node({ lit: raw, sort: 'String' }, []);
};

const parseTerm = (text) => {
  const t = text.trim();
  if (!t) throw new Error('Empty term');

  const litMatch = t.match(LITERAL_RE);
  if (litMatch) return parseLiteral(litMatch[1]);

  // Compound: op(args)
  const parenIdx = t.indexOf('(');
  if (parenIdx > 0 && t.endsWith(')')) {
    const op = t.slice(0, parenIdx).trim();
    if (!OP_RE.test(op)) throw new Error(`Invalid operator '${op}'`);
    const argsText = t.slice(parenIdx + 1, -1);
    const args = splitArgs(argsText).map(s => s.trim()).filter(Boolean).map(parseTerm);
    return node({ op }, args);
  }

  // Bare number or boolean
  const prim = parsePrimitiveLiteral(t);
  if (prim) return prim;

  // Symbol reference (dot-qualified names allowed)
  if (IDENT_RE.test(t)) return node({ name: t }, []);

  throw new Error(`Unparseable term: '${t}'`);
};

const parseDeclItem = (content) => {
  const parts = content.split(':').map(s => s.trim());
  if (parts.length !== 2) throw new Error(`Invalid declaration '${content}' — expected 'name : Sort'`);
  const [name, sort] = parts;
  if (!IDENT_RE.test(name)) throw new Error(`Invalid declaration name '${name}'`);
  if (!SORTS.has(sort)) throw new Error(`Unknown sort '${sort}' in declaration '${content}'`);
  return { name, sort };
};

const isIndented = (line) => /^\s/.test(line);

const isSectionHeading = (line) => /^#+\s/.test(line);
const sectionName = (line) => line.replace(/^#+\s*/, '').trim().toLowerCase();

const isBullet = (line) => /^\s*[-*]\s/.test(line);
const bulletContent = (line) => line.replace(/^\s*[-*]\s*/, '').trim();

// Collect top-level bullets and their nested children. Returns [{ head, children: [{head, children: []}] }].
const collectBullets = (lines, start, end) => {
  const bullets = [];
  let i = start;
  while (i < end) {
    const line = lines[i];
    if (!line.trim() || !isBullet(line)) { i++; continue; }
    if (isIndented(line)) { i++; continue; }
    const bullet = { head: bulletContent(line), children: [] };
    bullets.push(bullet);
    i++;
    while (i < end && (!lines[i].trim() || (isBullet(lines[i]) && isIndented(lines[i])))) {
      if (isBullet(lines[i])) bullet.children.push({ head: bulletContent(lines[i]), children: [] });
      i++;
    }
  }
  return bullets;
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

    const bullets = collectBullets(lines, sectionStart, sectionEnd);

    if (name === 'declare') {
      for (const b of bullets) declarations.push(parseDeclItem(b.head));
    } else if (name === 'assert') {
      for (const b of bullets) {
        const head = parseTerm(b.head);
        const ast = b.children.length === 0
          ? head
          : node({ op: 'and' }, [head, ...b.children.map(c => parseTerm(c.head))]);
        assertions.push({ source: b.head, node: ast });
      }
    } else if (name === 'check') {
      checkCount++;
      if (checkCount > 1) throw new Error('Multiple # check sections are not supported in v1');
      // v1: `check` takes no bullets; presence alone means "check-sat the conjunction of all asserts"
      if (bullets.length > 0) {
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
