/**
 * JSON Facts Parser
 *
 * Converts JSON data into Prolog-compatible entries using the same
 * { value, children } node shape as the Markdown parser.
 *
 * JSON mapping:
 *   Top-level keys → predicate names
 *   Values (array of arrays) → facts with those arguments
 *   Values (array of primitives) → single-argument facts
 *
 * Argument types:
 *   string  → atom node
 *   number  → number node
 *   boolean → atom node ("true" / "false")
 *   null    → atom node ("null")
 *   array   → Prolog list (cons cells)
 *   object  → compound term: key(values...)
 */

const jsonValueToNode = (value) => {
  if (value === null) return node('null');
  if (typeof value === 'boolean') return node(String(value));
  if (typeof value === 'number') return node(value);
  if (typeof value === 'string') return node(value);
  if (Array.isArray(value)) {
    return buildConsList(value.map(jsonValueToNode), node('[]'));
  }
  // Object → list of key:value pairs
  const pairs = Object.entries(value).map(([k, v]) =>
    node(':', [node(k), jsonValueToNode(v)])
  );
  return buildConsList(pairs, node('[]'));
};

const parseJSONFacts = (jsonString) => {
  const data = JSON.parse(jsonString);
  const entries = [];

  for (const [predName, facts] of Object.entries(data)) {
    const clauses = [];
    for (const fact of facts) {
      if (Array.isArray(fact)) {
        clauses.push({ headArgs: fact.map(jsonValueToNode), body: [] });
      } else {
        clauses.push({ headArgs: [jsonValueToNode(fact)], body: [] });
      }
    }
    entries.push({ name: predName, clauses });
  }

  return entries;
};
