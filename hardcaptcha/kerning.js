// Kerning Challenge Implementation

class KerningChallenge {
    static WORDS = [
        'BALANCE',
        'CAPTURE',
        'DIGITAL',
        'ELEGANT',
        'FACTORY',
        'GALAXY',
        'HARMONY',
        'JOURNEY',
        'KINDLE',
        'LIBERTY',
        'MAGNETIC',
        'NATURAL',
        'OPTIMAL',
        'PASSAGE',
        'QUALITY',
        'RADIANT'
    ];
    
    static generate() {
        const word = this.WORDS[Math.floor(Math.random() * this.WORDS.length)];
        const letters = word.split('');
        
        // Pick which letter will have correct kerning
        const correctIndex = Math.floor(Math.random() * letters.length);
        
        // Generate kerning values for each letter
        const kerning = [];
        letters.forEach((letter, index) => {
            if (index === correctIndex) {
                // Correct kerning (0 offset)
                kerning.push({ left: 0, right: 0 });
            } else {
                // Incorrect kerning: 1 or 2 pixels off on left or right
                const leftOffset = Math.random() > 0.5 ? 
                    (Math.random() > 0.5 ? 1 : 2) : 
                    (Math.random() > 0.5 ? -1 : -2);
                const rightOffset = Math.random() > 0.5 ? 
                    (Math.random() > 0.5 ? 1 : 2) : 
                    (Math.random() > 0.5 ? -1 : -2);
                kerning.push({ left: leftOffset, right: rightOffset });
            }
        });
        
        return {
            id: `kerning-${Date.now()}`,
            type: 'kerning',
            word: word,
            letters: letters,
            kerning: kerning,
            correctIndex: correctIndex,
            answer: correctIndex.toString(),
            instructions: 'Click on the letter that has correct spacing on both sides.',
            timeLimit: 60
        };
    }
    
    static render(challenge, container) {
        const challengeEl = document.getElementById(challenge.id);
        if (!challengeEl) return;
        
        const content = challengeEl.querySelector('.challenge-content');
        if (!content) return;
        
        // Create word display
        const wordDiv = document.createElement('div');
        wordDiv.className = 'kerning-word';
        wordDiv.style.cssText = 'display: flex; justify-content: center; align-items: center; font-size: 3rem; font-weight: bold; font-family: monospace; margin: 2rem 0; letter-spacing: 0;';
        
        challenge.letters.forEach((letter, index) => {
            const letterSpan = document.createElement('span');
            letterSpan.className = 'kerning-letter';
            letterSpan.textContent = letter;
            letterSpan.dataset.index = index;
            
            // Apply kerning
            const k = challenge.kerning[index];
            letterSpan.style.marginLeft = `${k.left}px`;
            letterSpan.style.marginRight = `${k.right}px`;
            letterSpan.style.cursor = 'pointer';
            letterSpan.style.transition = 'all 0.2s ease';
            letterSpan.style.padding = '0.5rem';
            letterSpan.style.borderRadius = '4px';
            
            letterSpan.addEventListener('click', () => {
                document.querySelectorAll(`#${challenge.id} .kerning-letter`).forEach(l => {
                    l.style.backgroundColor = '';
                    l.style.border = '';
                });
                letterSpan.style.backgroundColor = 'rgba(37, 99, 235, 0.1)';
                letterSpan.style.border = '2px solid var(--primary-color)';
            });
            
            letterSpan.addEventListener('mouseenter', () => {
                if (!letterSpan.style.backgroundColor) {
                    letterSpan.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                }
            });
            
            letterSpan.addEventListener('mouseleave', () => {
                if (!letterSpan.style.border) {
                    letterSpan.style.backgroundColor = '';
                }
            });
            
            wordDiv.appendChild(letterSpan);
        });
        
        content.appendChild(wordDiv);
    }
    
    static getAnswer(challenge) {
        const selected = document.querySelector(`#${challenge.id} .kerning-letter[style*="border"]`);
        return selected?.dataset.index || '';
    }
    
    static revealAnswer(challenge, challengeEl) {
        const letters = challengeEl.querySelectorAll('.kerning-letter');
        letters.forEach((letter, index) => {
            if (index === challenge.correctIndex) {
                letter.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                letter.style.border = '2px solid var(--success-color)';
            }
        });
    }
}

