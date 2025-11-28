import string
import os

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

    # Filter out empty lines and ensure uppercase. Use a set for O(1) lookups.
    words = set(w.strip().upper() for w in raw_words if w.strip())
    print(f"Loaded {len(words)} unique words.")

    pieces = set(string.ascii_uppercase)
    
    print("Generating pieces (length 2-3)...")
    # Iterate through all words to find substrings
    for word in words:
        length = len(word)
        # Generate all substrings of length 2 to 3
        for i in range(length):
            for j in range(i + 2, min(i + 4, length + 1)): # j is exclusive, so i+2 gives len 2, i+3 gives len 3
                substring = word[i:j]
                if substring not in words:
                    pieces.add(substring)

    print(f"Found {len(pieces)} pieces.")

    # Sort the lists for consistent output
    sorted_words = sorted(list(words))
    sorted_pieces = sorted(list(pieces))

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

        # Write PIECES
        f.write("const PIECES = [\n")
        for i, p in enumerate(sorted_pieces):
            f.write(f'"{p}"')
            if i < len(sorted_pieces) - 1:
                f.write(",")
            f.write("\n")
        f.write("];\n")
        
        # Export for Node.js/ESM if needed, or just global vars for browser
        f.write("\nif (typeof module !== 'undefined') module.exports = { WORDS, PIECES };\n")

    print("Done.")

if __name__ == "__main__":
    main()
