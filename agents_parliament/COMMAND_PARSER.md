# Command Line Parsing Specification

This document defines the requirements for command line argument parsing, designed for implementation with PEGGY (PEG parser generator).

## Basic Syntax

### Positional Arguments
- **MUST** preserve order of positional arguments

## Quoting and Escaping

### String Quoting
- **MUST** support multiline single quotes: `'string with spaces'`
- **MUST** support multiline double quotes: `"string with spaces"`
- **MUST** not perform shell expansion, and preserve content within quotes exactly
- **MUST** remove quote delimiters from final argument values (quotes are delimiters, not content)
- **MUST** literally preserve quotes within opposite quote type: `"it's fine"` or `'say "hello"'`
- **MUST** support escaped quotes in double quotes: `"say \"hello\""`
- **MUST NOT** support escaping within single quotes (single quotes are completely literal in bash)
  - Example: `'it\'s fine'` is invalid - the backslash is literal, not an escape
- **MUST** support exactly three backtick quotes for multi-line input
  - This is an allowed difference from bash
- **MUST** preserve newlines inside single, double quotes or triple backtick quotes, to support multi-line input
  - This is an allowed difference from bash
- **MUST NOT** support escaping within triple backtick quotes (triple backtick quotes are completely literal)
  - This is an allowed difference from bash
- **MUST** literally preserve single and double quotes within triple backtick quotes ` ```Say'n "hello"``` `
  - This is a difference from bash
- **MUST** preserve single or double backticks inside triple backtick quotes ` ```back`tick``` `
  - This is a difference from bash
- **MUST NOT** provide for escaped triple backticks
  - The next sequence of triple backticks is not enclosed, it simply closes the quote
  - IT **MUST** NOT BE POSSIBLE TO ENCLOSE TRIPLE BACKTICKS INSIDE TRIPLE BACKTICKS! COME ON!
  - This is a difference from bash
- **MUST** support multiline triple backtick quotes: ` ```line1 line2``` `
  - This is a difference from bash

### Escaping
- **MUST** support backslash escaping outside quotes: `\X` becomes `X` (backslash removed, character preserved)
  - `\\` double backslash becomes single backslash `\`, as in bash
- **MUST** support limited escaping in double quotes: `\"`, `\$`, `` ` ``, `\\` only
- **MUST** replace `\<newline>` with newline to support multiline inputs
  - Treat this newline as regular whitespace outside quotes
  - Treat as a literal newline inside quotes
  - This is an allowed difference with bash
- **MUST NOT** interpret escape sequences like `\n`, `\t`, `\r` in double quotes (they are literal in bash)
- **MUST NOT** support any escaping in single quotes (single quotes are completely literal)
- **MUST** preserve backslashes in double quotes that don't form recognized escape sequences
- Note: Bash only interprets `\n`, `\t`, etc. in `$'...'` (ANSI-C quoting), not in regular `"..."` quotes

### Whitespace Handling
- **MUST** split arguments on whitespace
- **MUST** treat any amount of whitespace as a single delimiter
- **MUST** preserve whitespace within quoted strings exactly
- **MUST** preserve newlines within quoted strings exactly (difference)
- **MUST** trim leading/trailing whitespace from the command string
- **MUST NOT** include whitespace in argument values (whitespace is a delimiter, not content)
- Example: `arg1    arg2` → two arguments `arg1` and `arg2` (multiple spaces treated as single delimiter)

## Error Handling

### Invalid Syntax
- **MUST** detect unterminated quotes: `"unclosed string`
- **MUST** provide clear error message with position/context

## Common Patterns

### Subcommands
- **MUST** support subcommand pattern: `command subcommand [options] [args]`
  - treat as a regular positional argument for application logic to handle

## Typing
- **MUST** handle all positional arguments as strings

## Edge Cases

### Special Values
- **MUST** handle empty arguments: `""` or `''` or ` `````` ` creates an empty string argument (array element exists but is empty)

### Unicode and Special Characters
- **MUST** support UTF-8 in argument values
- **MUST** preserve Unicode characters exactly
- **SHOULD** handle file paths with spaces and special characters

## Output Format

### Parsed Result Structure
- **MUST** return structured object with:
  - `positional`: array of positional arguments in order
  - `raw`: original argument array (for debugging)
- **MUST** handle all positional arguments as strings, ignoring type

## PEGGY-Specific Considerations

### Grammar Structure
- **MUST** define grammar rules for:
  - `command`: top-level entry point
  - `positional`: unquoted or quoted string (single, double, or triple backtick quotes)
  - `quoted_string`: single or double quoted with escapes
- **SHOULD** use semantic actions to build result structure
- **SHOULD** handle whitespace explicitly in grammar

### Error Reporting
- **SHOULD** leverage PEGGY's built-in error reporting
- **SHOULD** provide line/column information for syntax errors
- **SHOULD** include expected tokens in error messages
- **SHOULD** present errors as user-defined prompts so the LLM can correct and retry

### Performance
- **SHOULD** parse in single pass (PEG allows this)
- **SHOULD** avoid backtracking where possible
- **SHOULD** handle large argument lists efficiently
- **MUST** support multi-line commands (different)

## Testing Requirements

### Test Cases
- **MUST** test all MUST requirements
- **SHOULD** test all SHOULD requirements
- **SHOULD** include edge cases from Edge Cases section
- **SHOULD** test error cases from Error Handling section

### Example Test Cases
- Basic: `command arg1 arg2`
- Quoted: `command "path with spaces" 'another path'`
- Escaped in double quotes: `command "say \"hello\""`
- Single quotes (no escaping): `command 'it'\''s fine'` -> command, it'\''s fine
- Single quotes (no escaping) `command "it's fine"` -> command, it's fine
- Empty: `command ""`
- Unicode: `command "José"`
- Backslash outside quotes: `command /path/to\ file` → `/path/to file`
- Literal escape sequences: `command "line1\nline2"` → literal `\n`, not newline

## Implementation Notes

### Preprocessing
- **SHOULD** normalize line endings if reading from file
- **MUST** preserve exact input for raw output
- **NOTE**: Backtick quoting (``` for multi-line content) is NOT bash behavior - bash uses backticks for command substitution. If implemented, it should be documented as a non-bash extension.

### Validation
- **SHOULD** separate parsing from validation
- **SHOULD** allow custom validators to be registered
- **SHOULD** provide common validators (file exists, URL format, etc.)

### Extensibility
- **SHOULD** support plugin system for custom option types
- **SHOULD** allow custom help formatters
- **SHOULD** support configuration files for default options

# Omitted

- **MUST** handle backslash-newline outside quotes as line continuation (removed from input)
  - simply support multi-line input. The \<newline> is treated as <newline> and handled as whitespace

# Future implementation

For now we only need positional arguments with good quoting, but later we can implement flags and options

- **MUST** support positional arguments after all flags/options: `command arg1 arg2`
- **MUST** allow positional arguments even when flags/options are present
- **SHOULD** support required vs optional positional arguments

### Flags (Boolean Options)
- **MUST** support short flags: `-a`, `-b`, `-c`
- **MUST** support long flags: `--verbose`, `--help`, `--version`
- **MUST** support flag combinations: `-abc` (equivalent to `-a -b -c`)
- **MUST** treat flags as boolean (present = true, absent = false)
- **SHOULD** support `--no-` prefix for explicit false: `--no-verbose`
- Note: Bash passes `-abc` as a single argument; this parser interprets it as application-level flag parsing

### Options (Value-Bearing Arguments)
- **MUST** support short options with space: `-f file.txt`
- **MUST** support long options with space: `--file file.txt`
- **MUST** support short options with equals: `-f=file.txt`
- **MUST** support long options with equals: `--file=file.txt`
- **MUST** distinguish between flags and options (options require values)
- **SHOULD** support multiple values for the same option: `--file a.txt --file b.txt`
- Note: Bash passes these as separate arguments; this parser interprets them as application-level option parsing

### Option Terminator
- **MUST** support `--` as option terminator (everything after is positional)
- **MUST** allow `--` to be used even when no options precede it
- Example: `command --flag -- --positional` (treats `--positional` as positional arg)

### Unknown Options
- **MUST** detect unknown flags/options
- **MUST** provide clear error message: "Unknown option: --unknown"
- **MAY** suggest similar option names (fuzzy matching)

### Missing Values
- **MUST** detect when option requires value but none provided: `--file` (no value)
- **MUST** provide clear error message: "Option --file requires a value"
- **MUST** handle end-of-args gracefully: `command --file` (last arg)

### Invalid Syntax
- **MUST** detect malformed option syntax: `--=value`, `-=value`

### Built-in Help
- **MUST** recognize `--help` and `-h` as help requests
- **SHOULD** recognize `help` as a subcommand
- **SHOULD** generate usage string from option definitions

### Usage String Format
- **SHOULD** follow POSIX/GNU conventions:
  - `[OPTIONS]` for optional flags/options
  - `<ARG>` for required positional arguments
  - `[ARG]` for optional positional arguments
  - `...` for variadic arguments
- **SHOULD** group options by category (e.g., "Common options", "Advanced options")
- **SHOULD** include option descriptions and default values

### Version
- **MUST** recognize `--version` and `-V` as version requests
- **SHOULD** display version string from configuration

### Options for Subcommands
- **SHOULD** allow different options per subcommand
- **SHOULD** support global options that apply before subcommand
- **SHOULD** support subcommand-specific help: `command subcommand --help`

### Negation
- **SHOULD** support `--no-` prefix for boolean flags: `--no-cache`
- **SHOULD** treat `--flag` and `--no-flag` as mutually exclusive
- **SHOULD** allow explicit true: `--flag=true` or `--flag=1`

### Counters
- **SHOULD** support count flags: `-vvv` (equivalent to `-v -v -v` or `--verbose=3`)
- **SHOULD** accumulate count across multiple occurrences: `-v -v` = count of 2

### Environment Variable Fallback
- **SHOULD** support reading options from environment variables
- **SHOULD** use naming convention: `--api-key` → `API_KEY` or `COMMAND_API_KEY`
- **SHOULD** prioritize command line args over environment variables

### Special Values
- **MUST** handle empty strings: `--file=""` or `--file ''` (empty quoted strings create empty argument values)
- **MUST** handle values that look like flags: `--file=--not-a-flag`
- **MUST** handle values starting with dashes: `--file=-/path/to/file`

### Parsed Result Structure
- **MUST** return structured object with:
  - `flags`: object mapping flag names to boolean values
  - `options`: object mapping option names to values (or arrays for multiple)
  - `positional`: array of positional arguments in order
  - `raw`: original argument array (for debugging)
- **SHOULD** normalize option names (e.g., `--file` and `-f` map to same key)
- **SHOULD** support custom key names (e.g., `--api-key` → `apiKey`)
- **SHOULD** handle all flags and arguments as strings, ignoring type

### Example Test Cases
- Basic: `command --flag -o value arg1 arg2`
- Combined flags: `command -abc`
- Quoted: `command --file "path with spaces" 'another path'`
- Escaped in double quotes: `command --message "say \"hello\""`
- Single quotes (no escaping): `command --message 'it'\''s fine'` or `command --message "it's fine"`
- Terminator: `command --flag -- --positional`
- Empty: `command --file=""` or `command ""`
- Unicode: `command --name "José"`
- Backslash outside quotes: `command --file /path/to\ file` → `/path/to file`
- Literal escape sequences: `command --message "line1\nline2"` → literal `\n`, not newline

### Preprocessing
- **SHOULD** handle shell expansion (if applicable) before parsing
