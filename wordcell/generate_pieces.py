import string
import os
from collections import defaultdict

def main():
    # Ensure we are working in the correct directory or referencing files correctly
    # script is intended to be run from c:\work\yuwakisaweb\wordcell or with that as cwd
    
    input_file = 'enable1.txt'
    output_file = 'words_and_pieces.js'

    print(f"Reading {input_file}...")
    try:
        with open(input_file, 'r') as f:
            raw_words = f.read().splitlines()
    except FileNotFoundError:
        print(f"Error: {input_file} not found in {os.getcwd()}.")
        return

    # Filter out empty lines, ensure uppercase, and only keep words 3 letters or more
    words = set(w.strip().upper() for w in raw_words if w.strip() and len(w.strip()) >= 3)
    total_words = len(words)
    print(f"Loaded {total_words} unique words (3+ letters).")

    # Count piece frequencies (how many words contain each piece as a substring)
    piece_word_counts = defaultdict(set)  # Use set to track unique words per piece
    
    print("Counting piece frequencies...")
    for word in words:
        # Count single letters (each unique letter in the word)
        for char in set(word):
            piece_word_counts[char].add(word)
        
        # Count substrings of length 2-3
        length = len(word)
        found_substrings = set()
        for i in range(length):
            for j in range(i + 2, min(i + 4, length + 1)):
                substring = word[i:j]
                if substring not in words:  # Only count if not a word itself
                    found_substrings.add(substring)
        
        # Count each unique substring once per word
        for substring in found_substrings:
            piece_word_counts[substring].add(word)

    # Calculate frequencies (number of words containing piece / total_words)
    piece_frequencies = {}
    for piece, word_set in piece_word_counts.items():
        piece_frequencies[piece] = len(word_set) / total_words

    print(f"Found {len(piece_frequencies)} pieces with frequencies.")

    # Sort the lists for consistent output
    sorted_words = sorted(list(words))
    sorted_pieces = sorted(piece_frequencies.items())

    print(f"Writing to {output_file}...")
    with open(output_file, 'w') as f:
        # Write WORDS
        f.write("const WORDS = [\n")
        for i, w in enumerate(sorted_words):
            f.write(f'"{w}"')
            if i < len(sorted_words) - 1:
                f.write(",")
            f.write("\n")
        f.write("];\n\n")

        # Write PIECES as a map (object) with frequencies
        f.write("const PIECES = {\n")
        for i, (piece, frequency) in enumerate(sorted_pieces):
            f.write(f'    "{piece}": {frequency}')
            if i < len(sorted_pieces) - 1:
                f.write(",")
            f.write("\n")
        f.write("};\n")
        
        # Export for Node.js/ESM if needed, or just global vars for browser
        f.write("\nif (typeof module !== 'undefined') module.exports = { WORDS, PIECES };\n")

    print("Done.")

if __name__ == "__main__":
    main()
