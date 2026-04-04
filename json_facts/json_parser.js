/**
 * JSON Facts Parser
 *
 * Converts JSON into Prolog facts using the same { value, children }
 * node shape as the Markdown parser.
 *
 * Flattening rules — each top-level key becomes a predicate name,
 * then the value is walked recursively:
 *
 *   primitive         → one fact, value appended to args
 *   array             → iterate elements, each flattened independently
 *   array-in-array    → inner array is a tuple of remaining args
 *   object            → each key becomes an arg, recurse into value
 *
 * Examples:
 *   "human": ["alice", "bob"]                → human(alice). human(bob).
 *   "edge": [["a","b"]]                      → edge(a, b).
 *   "parent": {"tom": ["bob","liz"]}         → parent(tom, bob). parent(tom, liz).
 *   "capital": {"france": "paris"}           → capital(france, paris).
 *   "knows": {"tom": {"bob": ["chess"]}}     → knows(tom, bob, chess).
 */

const jsonValueToNode = (value) => {
  if (value === null) return node('null');
  if (typeof value === 'boolean') return node(String(value));
  if (typeof value === 'number') return node(value);
  if (typeof value === 'string') return node(value);
  // Array as a leaf value (inside a tuple) → Prolog list
  if (Array.isArray(value)) {
    return buildConsList(value.map(jsonValueToNode), node('[]'));
  }
  // Object as a leaf value (inside a tuple) → list of key:value pairs
  const pairs = Object.entries(value).map(([k, v]) =>
    node(':', [node(k), jsonValueToNode(v)])
  );
  return buildConsList(pairs, node('[]'));
};

const flattenValue = (value, prefix) => {
  // Primitive leaf: emit one fact
  if (value === null || typeof value !== 'object') {
    return [{ headArgs: [...prefix, jsonValueToNode(value)], body: [] }];
  }

  // Array: iterate elements
  if (Array.isArray(value)) {
    const clauses = [];
    for (const element of value) {
      if (Array.isArray(element)) {
        // Inner array = tuple of remaining args
        clauses.push({ headArgs: [...prefix, ...element.map(jsonValueToNode)], body: [] });
      } else {
        clauses.push(...flattenValue(element, prefix));
      }
    }
    return clauses;
  }

  // Object: each key becomes an additional argument
  const clauses = [];
  for (const [key, val] of Object.entries(value)) {
    clauses.push(...flattenValue(val, [...prefix, node(key)]));
  }
  return clauses;
};

const parseJSONFacts = (jsonString) => {
  const data = JSON.parse(jsonString);
  const entries = [];

  for (const [predName, value] of Object.entries(data)) {
    const clauses = flattenValue(value, []);
    entries.push({ name: predName, clauses });
  }

  return entries;
};
