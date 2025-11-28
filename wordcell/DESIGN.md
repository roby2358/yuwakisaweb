# Word Cell

## The Board
The game is played on a 12x12 grid playing area.
Multi-letter tiles occupy the grid, with one letter per grid cell.
A tile may contain one letter or more, up to 3.
Tiles are oriented horizontally, reading left to right.
Picking tiles are selected randomly with probabilities: 1-letter 40% 2-letter 50% 3-letter 10%

## The Tray
Along the bottom of the grid is a tray with 5 tiles of the same type.

## Game Play
The player may drag a tile from the tray to the playing area.
The player may drag a tile from one position in the playing area to another.
If when placing a tile, all the combined tiles in the same direction make a valid word from the game's dictionary, those tiles change color to indicate a valid word has been formed.
A sequence of tiles must make a word exactly, not a subset of a word, or the tiles form a subset.
The player may click on any tile that is part of a valid word to claim that word, which removes all tiles in that word from the board and awards points.
When the player claims a word, they score 1 point for each letter to the e power (length ^ e) truncated to the integer.

## Player Actions
The player has three actions they can perform at any time:
- **Redraw Tray**: Replaces all 5 tiles in the tray with 5 new randomly selected tiles. The player may only redraw their tray 3 times per game.
- **End Game**: Ends the game immediately and takes the player to the win overlay showing their final score.
- **Restart**: Resets the game and takes the player to the start game overlay (ready screen).

## Dictionary
Use the words in words_and_pieces.js as the dictionary of acceptable words.
Use the pieces in words_and_pieces.js for the list of peices to randomize.

# UI Notes

The board and tray view is the major view. There is also a game title banner, a Score: display, and game labels and controls.
The grid is shown very faintly so the player can see where tiles will go.
Very brief instructions along the bottom to drag tiles into place.
Three action buttons: Redraw Tray (shows remaining redraws), End Game, and Restart.

3 overlay panels for
Ready overlay: has a go button
Win overlay: the player has won, show their score
Lose overlay: the player has lost, show their score
