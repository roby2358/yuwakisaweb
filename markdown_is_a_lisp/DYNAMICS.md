# DYNAMICS.md

How the MarkdownIsALISP interpreter works.

## The Core Claim

Markdown is a LISP. Not metaphorically. The interpreter treats Markdown as an S-expression syntax: headings define functions, bullet nesting forms the AST, and the resulting tree is the structure the evaluator executes. Code and data share the same representation. The language can decompose, construct, and evaluate its own code at runtime.

## One Node Shape

Everything in the language — parsed code, runtime values, data structures — is the same shape:

```js
{ value: <any>, children: [] }
```

A node with no children is an **atom**. A node with children is a **compound form**. There is no `NodeType` enum, no separate AST node classes. The `node(value, children)` constructor is the only way nodes are created.

### What `.value` holds

| Value type | Meaning | Example |
|---|---|---|
| `number` | Numeric literal | `{ value: 5, children: [] }` |
| `{ string: '...' }` | String literal | `{ value: { string: 'hello' }, children: [] }` |
| `boolean` | Boolean result | `{ value: true, children: [] }` |
| `null` | Null / data list container | `{ value: null, children: [...] }` |
| `string` | Symbol (variable/function name) | `{ value: 'factorial', children: [] }` |

String literals use the `{ string: '...' }` wrapper to distinguish them from symbols. The bare string `'factorial'` is a symbol that gets looked up in the environment. The wrapped value `{ string: 'factorial' }` is a string literal that evaluates to itself.

## Parsing: Markdown → Labeled Tree

The parser reads Markdown and produces the tree the evaluator will execute directly. No intermediate representation, no post-processing pass.

### Headings become definitions

```markdown
# factorial
```

Produces a definition object `{ _isDef: true, name: 'factorial', children: [...] }`. Definitions are the top-level organizational unit. They are not nodes — they are containers that the runner registers into the environment.

### Bullets become nodes

```markdown
* +
  * `1`
  * `2`
```

Produces:

```js
{ value: '+', children: [
  { value: 1, children: [] },
  { value: 2, children: [] }
]}
```

The bullet text becomes `.value`. Sub-bullets become `.children`. Indentation (2 spaces = 1 level) determines nesting. The parser uses an indent-tracking stack to assign children to the correct parent — each new bullet pops the stack back to the appropriate depth, then attaches to whatever node is on top.

### Backtick-wrapped values are literals

- `` `42` `` → `node(42)` (number)
- `` `"hello"` `` → `node({ string: 'hello' })` (string literal)
- `` `true` `` → `node({ string: 'true' })` (parsed as string — no special boolean syntax)

Bare words (no backticks) are symbols: `factorial` → `node('factorial')`.

## Evaluation

The evaluator walks the tree. The dispatch is simple because the node shape carries the information directly.

### Atoms (no children)

```js
if (n.children.length === 0) {
  if (isSelfEvaluating(n.value)) return n;   // numbers, strings, booleans, null
  if (typeof n.value === 'string') return getVar(env, n.value);  // symbol lookup
  return n;
}
```

A number evaluates to itself. A symbol looks up its binding in the environment. That's it.

### Compound forms (has children)

`.value` is the operator. `.children` are the arguments.

```js
const opName = n.value;
```

No need to extract the operator from the first child of a flat list. The labeled tree carries the operator as the label.

### Special forms

Four special forms are handled before general function application:

- **`quote`** — Returns the first child unevaluated. This is how the language refers to code as data.
- **`if`** — Evaluates the condition (first child), then evaluates either the consequent (second child) or alternate (third child). Truthiness: `false`, `null`, and `0` are falsy; everything else is truthy.
- **`lambda`** — First child is the parameter spec, remaining children are the body. Creates a closure capturing the current environment.
- **`eval`** — Evaluates its argument, then evaluates the result. The bridge from data back to code.

### Function application

For non-special-form calls, the evaluator looks up the operator name in the environment, evaluates all children to get arguments, then applies:

- **User-defined closures** (`_isLambda`): Create a new environment extending the closure's captured environment, bind parameters to arguments, evaluate the body.
- **Builtins** (JS functions): Call directly with the argument nodes. Builtins receive and return nodes — they access `.value` directly, no unwrapping layer.

## Definitions and Registration

The runner registers each definition into the global environment before execution begins.

### Constants

A definition with a single self-evaluating child:

```markdown
# pi
* `3.14`
```

Binds `pi` to `node(3.14)` directly.

### Functions with parameters

A definition whose first child is a parameter spec (a symbol or symbol-with-symbol-children):

```markdown
# factorial
* n
* if
  ...
```

The first child `n` is the parameter spec. Everything after is the body. Registers as `makeClosure(['n'], bodyNodes, globalEnv)`.

### Multi-parameter functions

Parameters can be listed as children of the first bullet:

```markdown
# gcd
* *
  * a
  * b
* if
  ...
```

The `*` with children `a`, `b` is the parameter spec. `extractParams` reads `[a, b]` from the children.

### Zero-argument functions

If the first child doesn't look like a parameter spec (it's a literal, or a symbol with non-symbol children), all children become the body of a zero-arg closure.

### Entry point

After all definitions are registered, the runner looks up `main` and invokes it. If `main` doesn't exist, it reports the absence without crashing.

## Environments

Lexical scoping via linked environment frames:

```js
{ parent: <env | null>, vars: { name: value, ... } }
```

Variable lookup walks the parent chain. Closures capture their defining environment. Each function call creates a new frame extending the closure's environment — not the caller's. This is standard lexical scoping.

## The Homoiconicity Constraint

The language must be able to fully decompose and reconstruct its own code at runtime. The representation the parser produces, the evaluator executes, and the language manipulates must be the same `{ value, children }` shape.

This is satisfied by two independent primitive sets that access the same node shape for different purposes.

### Tree primitives: `tag`, `children`, `make-node`

These are for **code introspection and construction** — working with labeled tree nodes as the evaluator sees them.

| Primitive | Reads | Returns |
|---|---|---|
| `tag` | `.value` | Atom carrying the label |
| `children` | `.children` | Data list of sub-nodes |
| `make-node` | — | New labeled node from tag + children list |

`tag` extracts the label: `(tag (quote (+ 1 2)))` → `+`.

`children` extracts the sub-nodes as a flat data list (a null-valued node whose `.children` are the sub-nodes): `(children (quote (+ 1 2)))` → a list containing `1` and `2`.

`make-node` assembles a labeled node from a tag atom and a data list of children: `(make-node (quote *) (children (quote (+ 1 2))))` → `(* 1 2)`.

The round-trip is lossless: `(make-node (tag x) (children x))` reconstructs `x` for any node. This is the homoiconicity proof — the language can take apart any piece of its own code and put it back together, or rearrange the pieces into new code and `eval` the result.

### List primitives: `car`, `cdr`, `cons`, `list`

These are for **flat data lists** — ordered sequences stored as children of a null-valued node.

A data list:

```js
{ value: null, children: [
  { value: 1, children: [] },
  { value: 2, children: [] },
  { value: 3, children: [] }
]}
```

| Primitive | Operation |
|---|---|
| `car` | Returns `.children[0]` — the first element |
| `cdr` | Returns `.children[1:]` wrapped in a null-valued node — the rest |
| `cons` | Prepends an element: flattens into an existing list, or creates a pair |
| `list` | `node(null, args)` — wraps arguments as flat children |

`cons` flattens when prepending to an existing list: `(cons a (list b c))` → `{ value: null, children: [a, b, c] }`, not nested.

`cdr` of a two-element list returns the second element directly (classic cons pair behavior). `cdr` of a single-element list throws.

### The interop point

`children` outputs a data list. `car`/`cdr` can walk it. `make-node` accepts a data list as input. This is where the two primitive sets shake hands:

```markdown
# main
* print
  * car
    * children
      * quote
        * +
          * `1`
          * `2`
```

`children` extracts `(1 2)` as a data list. `car` of that returns `1`. Tree primitives decompose the code, list primitives navigate the pieces.

### Why two sets instead of one

A labeled tree node and a flat data list are genuinely different uses of the same `{ value, children }` shape. A code node `(+ 1 2)` has `+` as its value — that's the operator. A data list `(1 2 3)` has `null` as its value — it's just a container.

`car` of `(+ 1 2)` returns `1` (the first child). `tag` of `(+ 1 2)` returns `+` (the label). These are different operations answering different questions. Collapsing them into one primitive creates contradictions. Two primitive sets, one node shape, no confusion.

## Builtins and the Node Boundary

Builtins receive argument nodes and return result nodes. They access `.value` directly — there is no universal unwrapping function between builtins and nodes.

```js
setVar(env, '-', (a, b) => node(a.value - b.value));
setVar(env, 'eq', (a, b) => node(a.value === b.value));
```

The string literal wrapper `{ string: '...' }` requires explicit handling in the specific builtins that encounter it: `+` (concatenation), `eq`/`!=` (comparison), and `print` (output formatting). Each handles it inline rather than through a general-purpose extraction function. This keeps the boundary between node-land and raw-JS-land explicit and local.

## `nodeToMarkdown`: The Round-Trip

Because the AST shape matches the Markdown shape, serialization is direct:

- Atom with number → `` `5` ``
- Atom with string wrapper → `` `"hello"` ``
- Atom with bare string → bare word (symbol)
- Node with string `.value` and children → bullet text is `.value`, children are nested bullets
- Node with null `.value` and children → data list, render children as sibling bullets
- Lambda closure → `lambda` bullet with parameter and body sub-bullets
- Definitions → `# name` headers

The parser produces what `nodeToMarkdown` serializes, and `nodeToMarkdown` produces what the parser reads. This is not a pretty-printer — it is the canonical representation. Markdown IS the S-expression syntax.

## `parse`: Runtime Access to the Parser

The `parse` builtin takes a string of Markdown source and returns the parsed AST as a node the evaluator can operate on. This closes the loop: a program can construct Markdown source as a string, parse it into nodes, manipulate those nodes with `tag`/`children`/`make-node`, and `eval` the result. The full metaprogramming cycle runs within the language.

## Execution Flow

1. **Parse** — `parseMarkdown(source)` produces an array of definition objects.
2. **Setup** — `setupStandardLibrary` registers builtins into the global environment.
3. **Register** — Each definition is analyzed (constant, parameterized function, or zero-arg function) and bound in the global environment.
4. **Execute** — The `main` closure is looked up and its body is evaluated.
5. **Output** — `print` sends formatted output to the log callback. `print-ast` serializes a node back to Markdown and logs it.
