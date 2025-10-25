# Files
- The page must be written as index.html
- It MUST be backed by css/index.css
- It MUST pull in a reset css to clear default formatting
- It MUST be backed by js/index.js
- It MUST be backed by a js/thred.js which instantiates a new Thred object ob page load
- It MUST use jquery for all dynamic HTML
- It MUST NOT use domain model functions, only jquery
# Page Layoyt
- The UI MUST be split in 3 panes which line up horizontally and span the window vertically from top to bottom
- The middle panel MUST be 200px wide with the other two panels filling the remaining space horizontally
- The first pane MUST contain an editable text area which holds the code
- The second pane MUST contain control buttons
- The initial control buttons MUST be RUN and CLEAR
- The third panel MUST contain a div into which the output from the program goes
# Functionality
- the RUN button MUST pass the contents of the code text area to the Thred run method
- the output of Thred run must go into the output display div
- newlines in the output MUST be replaced with <br/>
- the CLEAR button MUST remove any text from the output display div
