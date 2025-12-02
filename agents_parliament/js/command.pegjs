{
  // PEG grammar for command-line argument parsing
  // Implements bash-compatible parsing with extensions for triple backticks
  
  // Export CommandParser class wrapper for ES modules
  // This code is included in the generated parser file
}

command
  = whitespace? first:argument? rest:(whitespace+ arg:argument { return arg; })* whitespace? { 
      const args = [];
      if (first !== null && first !== undefined && first !== '') args.push(first);
      args.push.apply(args, rest.filter(function(a) { return a !== null && a !== undefined && a !== ''; }));
      return args;
    }

argument
  = quoted_triple_backtick
  / quoted_single
  / quoted_double
  / unquoted

// Triple backtick quotes (exactly three backticks, no escaping, closes on next three)
quoted_triple_backtick
  = "```" content:triple_backtick_content? "```" { return content || ''; }

triple_backtick_content
  = chars:triple_backtick_char* { return chars.join(''); }

triple_backtick_char
  = !"```" char:. { return char; } // Any character that's not three backticks

// Single quotes (completely literal, no escaping whatsoever)
quoted_single
  = "'" content:single_quote_content? "'" { return content || ''; }

single_quote_content
  = chars:single_quote_char* { return chars.join(''); }

single_quote_char
  = !"'" char:. { return char; } // Any character except single quote

// Double quotes (limited escaping: \", \$, \`, \\, \<newline> only)
quoted_double
  = '"' content:double_quote_content? '"' { return content || ''; }

double_quote_content
  = chars:double_quote_char* { return chars.join(''); }

double_quote_char
  = "\\" "\n" { return '\n'; } // Backslash-newline becomes literal newline
  / "\\" '"' { return '"'; }   // Escaped quote
  / "\\" '$' { return '$'; }   // Escaped dollar
  / "\\" '`' { return '`'; }   // Escaped backtick
  / "\\" '\\' { return '\\'; } // Escaped backslash
  / "\\" other:. { return '\\' + other; } // Preserve backslash for unrecognized escapes
  / [^"\\] { return text(); } // Any character except quote or backslash

// Unquoted argument (backslash escapes next character, backslash-newline becomes newline treated as whitespace)
unquoted
  = chars:unquoted_char+ { 
      const result = chars.join('');
      const trimmed = result.trim();
      return trimmed === '' ? null : trimmed;
    }

unquoted_char
  = "\\" "\n" { return '\n'; } // Backslash-newline becomes newline (whitespace)
  / "\\" esc:. { return esc; } // Backslash escapes next character (backslash removed)
  / ![ \t\n\r\\] char:. { return char; } // Any character except whitespace or backslash

whitespace
  = [ \t\n\r]+

