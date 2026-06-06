# Initial
- The Thread language MUST be implemented in a thred.js file Thread object
- It MUST provide a "run" method which takes code as a string parameter
- For now, it MUST return "ran" as the output

# Parsing
- Code MUST be parsed at runtime into an intermediate representation
- The code MUST be parsed into a list of instructions
  - Each instruction contains an incrementing counter and a reference to the word (n, instruction reference, line reference)

# Execution
- The interpretor MUST execute the list of instructions in order, sending output to the output div
- The interpretor keeps a stack onto wich values are pushed and popped

# Initial instruction set
- Integer literals -?[0-9]+ the in