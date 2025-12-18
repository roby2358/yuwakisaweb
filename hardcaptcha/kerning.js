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
                // Correct kerning (0 offset on both sides)
                kerning.push({ left: 0, right: 0 });
            } else if (index === correctIndex - 1) {
                // Letter to the left of correct letter: right side must be 0 (touching correct letter)
                const erroneousValues = [-3, -2, -1, 1, 2, 3];
                const leftOffset = erroneousValues[Math.floor(Math.random() * erroneousValues.length)];
                kerning.push({ left: leftOffset, right: 0 });
            } else if (index === correctIndex + 1) {
                // Letter to the right of correct letter: left side must be 0 (touching correct letter)
                const erroneousValues = [-3, -2, -1, 1, 2, 3];
                const rightOffset = erroneousValues[Math.floor(Math.random() * erroneousValues.length)];
                kerning.push({ left: 0, right: rightOffset });
            } else {
                // All other letters: incorrect kerning on both sides (never 0)
                const erroneousValues = [-3, -2, -1, 1, 2, 3];
                const leftOffset = erroneousValues[Math.floor(Math.random() * erroneousValues.length)];
                const rightOffset = erroneousValues[Math.floor(Math.random() * erroneousValues.length)];
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
            instructions: 'Click on the letter that has correct kerning on both sides.',
            explanation: 'While artificial intelligences match patterns and discard the spaces in between, biological intelligences need their full vision.',
            timeLimit: 60
        };
    }
    
    static render(challenge, container) {
        if (!container) return;
        
        // Create word display
        const wordDiv = document.createElement('div');
        wordDiv.className = 'kerning-word';
        wordDiv.style.cssText = 'display: flex; justify-content: center; align-items: center; font-size: 3rem; font-weight: bold; font-family: monospace; margin: 2rem 0; letter-spacing: 0; gap: 0;';
        
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
            letterSpan.style.padding = '0';
            letterSpan.style.marginTop = '0';
            letterSpan.style.marginBottom = '0';
            letterSpan.style.lineHeight = '1';
            letterSpan.style.borderRadius = '4px';
            
            let lastTouchTime = 0;
            const TOUCH_DELAY = 300;
            
            const handleSelection = (e) => {
                const now = Date.now();
                
                if (e.type === 'touchend') {
                    e.preventDefault();
                    e.stopPropagation();
                    lastTouchTime = now;
                } else if (e.type === 'click') {
                    if (now - lastTouchTime < TOUCH_DELAY) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                }
                
                wordDiv.querySelectorAll('.kerning-letter').forEach(l => {
                    l.classList.remove('selected');
                    l.style.backgroundColor = '';
                    l.style.border = '';
                });
                letterSpan.classList.add('selected');
                letterSpan.style.backgroundColor = 'rgba(37, 99, 235, 0.1)';
                letterSpan.style.border = '2px solid var(--primary-color)';
            };
            
            letterSpan.addEventListener('click', handleSelection);
            letterSpan.addEventListener('touchend', handleSelection, { passive: false });
            
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
        
        container.appendChild(wordDiv);
    }
    
    static getAnswer(challenge) {
        // Find the challenge element - it should be the most recent one with this ID
        const challengeEl = document.getElementById(challenge.id);
        if (!challengeEl) {
            return '';
        }
        
        // Verify this is the active challenge (in the challenges container)
        const container = document.getElementById('challengesContainer');
        if (!container.contains(challengeEl)) {
            return '';
        }
        
        // Look for selected letter by class or border style
        const selected = challengeEl.querySelector('.kerning-letter.selected') || challengeEl.querySelector('.kerning-letter[style*="border"]');
        if (!selected) {
            return '';
        }
        
        const index = parseInt(selected.dataset.index);
        if (isNaN(index)) {
            return '';
        }
        
        return index.toString();
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

