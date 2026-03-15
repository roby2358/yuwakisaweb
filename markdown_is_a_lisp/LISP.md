# LISP.md

What makes a language a LISP, and how MarkdownIsALISP satisfies each constraint.

## McCarthy's Requirements

John McCarthy's original LISP (1960) established a set of properties that together define the LISP family. These are not stylistic preferences — they are structural requirements. A language that meets all of them is a LISP. A language that misses any of them is something else wearing LISP's syntax.

MarkdownIsALISP meets all of them, using Markdown as the concrete syntax and a labeled tree as the internal representation.

## 1. Code and Data Share the Same Representation

**The constraint:** Programs are written in the same data structures the language manipulates. There is no separate "code format" and "data format." A piece of code IS a piece of data, and any piece of data can be treated as code.

**How it's met:** Everything — parsed source, runtime values, data structures, quoted code — is `{ value, children }`. The parser produces this shape. The evaluator executes this shape. `quote` returns this shape. `eval` accepts this shape. The program's own AST is a value the program can hold, inspect, modify, and execute.

```markdown
# main
* eval
  * quote
    * +
      * `1`
      * `2`
```

`quote` prevents evaluation, returning the `(+ 1 2)` node as data. `eval` takes that data and executes it as code. The node didn't change shape between these roles. It was always `{ value: '+', children: [{value: 1}, {value: 2}] }`.

## 2. The Language Can Decompose Its Own Code

**The constraint:** The language provides primitives to take apart any expression into its constituent pieces. In classic LISP, `car` and `cdr` decompose lists. The requirement is not "has `car`/`cdr`" — it's "can fully decompose any code structure the evaluator operates on."

**How it's met:** Three tree primitives decompose any node:

- `tag` reads the label: `(tag (quote (+ 1 2)))` → `+`
- `children` reads the sub-expressions: `(children (quote (+ 1 2)))` → `(1 2)`
- Together they extract everything the evaluator uses: the operator (`.value`) and the operands (`.children`).

Classic LISP could use `car`/`cdr` for this because LISP code was flat lists — the operator was the first element. MarkdownIsALISP code is a labeled tree — the operator is the label. `tag`/`children` are the decomposition primitives that match this structure. They answer the same question McCarthy's `car`/`cdr` answered ("what are the parts of this expression?") for the structure Markdown actually produces.

## 3. The Language Can Construct Its Own Code

**The constraint:** The language provides primitives to build new expressions from parts. In classic LISP, `cons` constructs lists. The requirement is not "has `cons`" — it's "can build any code structure the evaluator will accept."

**How it's met:** `make-node` constructs a labeled tree node from a tag and a list of children:

```markdown
* make-node
  * quote
    * *
  * children
    * quote
      * +
        * `1`
        * `2`
```

This builds `(* 1 2)` — takes the children from `(+ 1 2)` and attaches them to a new operator. The result is a node the evaluator can execute.

The round-trip is lossless: `(make-node (tag x) (children x))` reconstructs `x` for any node `x`. Any code structure can be taken apart and reassembled, or assembled from scratch.

## 4. Quoting Suppresses Evaluation

**The constraint:** There must be a mechanism to refer to code without executing it — to treat an expression as data. In classic LISP, this is `quote` (abbreviated `'`).

**How it's met:** `quote` is a special form. The evaluator recognizes it and returns the child node unevaluated:

```js
if (opName === 'quote') return n.children[0];
```

Without `quote`, writing `(+ 1 2)` always executes the addition. With `quote`, writing `(quote (+ 1 2))` returns the node representing `(+ 1 2)` as inert data. This is the toggle between code-mode and data-mode, and it's essential for metaprogramming — you can't manipulate code you can't hold without executing.

## 5. `eval` Bridges Data Back to Code

**The constraint:** There must be a mechanism to take data and execute it as code. In classic LISP, this is `eval`.

**How it's met:** `eval` is a special form that evaluates its argument, then evaluates the result:

```js
if (opName === 'eval') return evaluate(evaluate(n.children[0], env), env);
```

`quote` turns code into data. `eval` turns data into code. Together they form the bridge:

```markdown
* eval
  * quote
    * +
      * `1`
      * `2`
```

First evaluation: `quote` returns the `(+ 1 2)` node. Second evaluation: the node is executed as code, yielding `3`. The data became code again.

## 6. Lambda Creates Anonymous Functions

**The constraint:** Functions are values. They can be created at runtime, passed as arguments, returned from other functions, and stored in data structures. In classic LISP, `lambda` creates anonymous functions.

**How it's met:** `lambda` is a special form that captures parameters, body, and the defining environment into a closure:

```markdown
* lambda
  * x
  * +
    * x
    * `1`
```

This produces `{ _isLambda: true, params: ['x'], body: [...], env: <captured> }`. Closures are first-class values — they can be bound to names, passed to functions, or returned. When applied, a new environment frame extends the captured environment, not the caller's. This is lexical scoping.

## 7. Conditional Evaluation

**The constraint:** The language must be able to choose between alternatives based on a condition, without evaluating the unchosen branch. In classic LISP, this is `cond` or `if`.

**How it's met:** `if` is a special form with three children: condition, consequent, alternate. Only the chosen branch is evaluated:

```js
const test = evaluate(n.children[0], env);
if (isTruthy(test)) return evaluate(n.children[1], env);
return n.children[2] ? evaluate(n.children[2], env) : node(null);
```

This must be a special form, not a function. Functions evaluate all arguments before application — that would evaluate both branches, destroying the point of branching and making recursion impossible (the base case's branch would never stop the recursive branch from being evaluated).

## 8. Recursion as the Primary Control Structure

**The constraint:** The language uses recursion rather than iteration for repetition. Functions can call themselves, and the language is expressive enough that recursion naturally handles all looping patterns.

**How it's met:** There are no loop constructs. All repetition is recursive:

```markdown
# factorial
* n
* if
  * <=
    * n
    * `1`
  * `1`
  * *
    * n
    * factorial
      * -
        * n
        * `1`
```

`factorial` calls itself with `(- n 1)` until the base case. This works because definitions are registered in the global environment before execution — `factorial`'s closure captures the global environment, and by the time it's called, `factorial` is bound in that environment.

## 9. Garbage Collection / Automatic Memory Management

**The constraint:** The programmer doesn't manually allocate or free memory. The runtime handles it.

**How it's met:** The language runs on JavaScript. Node objects are garbage-collected by the JS engine. Environment frames become unreachable when no closure references them. No manual memory management is exposed or needed.

## What MarkdownIsALISP Adds Beyond McCarthy

McCarthy's LISP used flat lists (`cons` cells) as the universal structure because that was the simplest representation that could carry both code and data. MarkdownIsALISP uses a richer structure — the labeled tree — because Markdown hands it over for free. The bullet text is a label that flat lists don't have.

This doesn't violate any LISP constraint. It satisfies them differently:

| McCarthy's LISP | MarkdownIsALISP | Same constraint |
|---|---|---|
| `(+ 1 2)` — flat list, `+` is first element | `{ value: '+', children: [1, 2] }` — labeled tree, `+` is the label | Code is a data structure |
| `car` gets the operator (first element) | `tag` gets the operator (the label) | Can decompose code |
| `cdr` gets the arguments (rest of list) | `children` gets the arguments (the sub-nodes) | Can decompose code |
| `cons` builds lists | `make-node` builds labeled nodes | Can construct code |
| One structure (cons cell) for everything | One structure (`{ value, children }`) for everything | Uniform representation |

The constraint was never "use cons cells." The constraint was "the language must be able to fully decompose and construct its own code using the same structures the evaluator operates on." `tag`/`children`/`make-node` satisfy this for the labeled tree the same way `car`/`cdr`/`cons` satisfied it for McCarthy's flat lists.

MarkdownIsALISP also has `car`/`cdr`/`cons`/`list` — but these operate on flat data lists (null-valued container nodes), not on code. Two primitive sets, one node shape, each doing the job it's suited for.

## The Litmus Test

Can the language take apart a piece of its own code, rearrange it, and execute the result?

```markdown
# main
* print
  * tag
    * quote
      * +
        * `1`
        * `2`
* print
  * eval
    * make-node
      * quote
        * *
      * children
        * quote
          * +
            * `1`
            * `2`
```

Output:

```
+
2
```

Line 1: `tag` extracts the operator from quoted code. The language can see inside its own expressions.

Line 2: `children` extracts the operands from `(+ 1 2)`, `make-node` attaches them to `*` instead, `eval` executes the result as `(* 1 2)`. The language performed surgery on its own code and ran the result.

That's homoiconicity. That's LISP. The syntax is Markdown.

## How MIAL Leverages Markdown's Tree Structure

Markdown isn't just a convenient surface syntax. Its structural features — headings, nested bullet lists, inline code spans — map onto LISP concepts so directly that the parser has almost nothing to do. Each Markdown feature pulls weight that classic LISP syntax has to encode implicitly or through convention.

### Headings are `defun`

In classic LISP, function definitions are expressions like everything else: `(defun factorial (n) ...)`. The definition name, parameter list, and body are all elements of the same flat list, distinguished only by position.

Markdown headings are structurally different from body content. `# factorial` is not a bullet — it's a section boundary. MIAL uses this to make definitions a syntactic category, not a convention. The parser doesn't need to recognize `defun` as a keyword or count positions in a flat list. A heading IS a definition. Everything under it IS the body. The structure enforces what LISP leaves to the programmer.

### Nesting is parentheses

LISP's parentheses exist to encode tree structure into a flat character stream. Every `(` opens a nesting level, every `)` closes one. The programmer mentally tracks depth.

Markdown bullet indentation IS nesting. Two spaces in, one level deeper. The tree structure is spatial — visible in the shape of the text on screen. No brackets to match, no depth to count. The parser reads indentation levels and builds the tree directly, using an indent-tracking stack that produces exactly the structure the evaluator needs with zero post-processing.

This isn't cosmetic. A LISP expression like `(if (<= n 1) 1 (* n (factorial (- n 1))))` has seven nesting levels encoded by parentheses in a single line. The same expression in MIAL:

```markdown
* if
  * <=
    * n
    * `1`
  * `1`
  * *
    * n
    * factorial
      * -
        * n
        * `1`
```

Every nesting level is visible. The tree structure is the text layout.

### Backticks distinguish literals from symbols

Classic LISP distinguishes symbols from literals by type: `42` is a number, `"hello"` is a string, `factorial` is a symbol. But bare words are always symbols, and there's no unified syntax for "this is a literal value."

Markdown's inline code spans (`` `...` ``) provide exactly this distinction. `` `42` `` is a literal. `` `"hello"` `` is a literal. `factorial` without backticks is a symbol. The backtick is a universal literal marker — one syntactic feature that covers numbers, strings, booleans, and null.

### Multi-child nodes are n-ary by default

A cons cell holds exactly two things. To represent `(+ 1 2 3)`, classic LISP builds a linked list of pairs: `(+ . (1 . (2 . (3 . nil))))`. The three-argument call is encoded as a chain of binary cells.

A Markdown bullet can have any number of sub-bullets. `{ value: '+', children: [1, 2, 3] }` is the natural representation — the parser produces it directly. MIAL's labeled tree is n-ary by default, not binary. This means the node shape matches the intent (a function applied to three arguments) rather than encoding it through a chain of pairs.

This is why MIAL has two primitive sets. The labeled tree (`tag`/`children`/`make-node`) handles n-ary code nodes naturally. Flat data lists (`car`/`cdr`/`cons`/`list`) handle ordered sequences. Classic LISP needed one primitive set because cons cells were the only structure. MIAL can afford two because Markdown gave it a richer structure to start with.

### Multi-expression bodies are implicit

In classic LISP, a function body with multiple expressions requires `progn` or `begin` to sequence them: `(defun foo () (progn (do-a) (do-b)))`. The sequencing is explicit syntax.

In MIAL, a definition with multiple top-level bullets under a heading has multiple body expressions naturally. The runner collects `def.children.slice(1)` (everything after the parameter spec) as the body array and evaluates them in sequence. Multiple bullets under a heading just ARE a multi-expression body. No sequencing keyword needed.

### The parser is 30 lines

The consequence of all this structural alignment: the parser (`parseMarkdown`) is roughly 30 lines of code. It doesn't need a tokenizer. It doesn't need a recursive descent grammar. It splits on newlines, checks for `#` (heading) or `*`/`-` (bullet), reads indentation, and builds the tree. Markdown already did the hard work of encoding tree structure into text.

Classic LISP's parser is also simple — matching parentheses is easy. But MIAL's parser is simple for a different reason: it's not parsing structure FROM syntax, it's reading structure that's ALREADY THERE in the visual layout of the document. The tree is the text.
