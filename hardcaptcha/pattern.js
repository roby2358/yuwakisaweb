// Pattern Challenge Implementation

class PatternChallenge {
    static randn(a, b) {
        return Math.floor(Math.random() * (b - a)) + a;
    }
    
    static generate() {
        const gridSize = 4;
        const totalSquares = gridSize * gridSize; // 16 squares
        const pattern = [];
        
        // Pick which component (R, G, or B) will be consistent
        const consistentComponent = this.randn(0, 3); // 0=R, 1=G, 2=B
        const consistentValue = this.randn(0x80, 0xD1); // 128-208 in decimal
        
        // Pick which square will be the odd one out
        const oddIndex = this.randn(0, totalSquares);
        
        // Generate the "out" square's consistent component value
        // Must have absolute difference of 16 or more from consistentValue
        let outComponentValue;
        do {
            outComponentValue = this.randn(0x80, 0xD1);
        } while (Math.abs(outComponentValue - consistentValue) < 16);
        
        // Generate all 16 squares
        for (let i = 0; i < totalSquares; i++) {
            if (i === oddIndex) {
                // The odd one out: consistent component has value with abs diff >= 16, other two are random
                const r = consistentComponent === 0 ? outComponentValue : this.randn(0x80, 0xD1);
                const g = consistentComponent === 1 ? outComponentValue : this.randn(0x80, 0xD1);
                const b = consistentComponent === 2 ? outComponentValue : this.randn(0x80, 0xD1);
                pattern.push({ r, g, b });
            } else {
                // 15 squares with one consistent component
                const r = consistentComponent === 0 ? consistentValue : this.randn(0x80, 0xD1);
                const g = consistentComponent === 1 ? consistentValue : this.randn(0x80, 0xD1);
                const b = consistentComponent === 2 ? consistentValue : this.randn(0x80, 0xD1);
                pattern.push({ r, g, b });
            }
        }
        
        return {
            id: `pattern-${Date.now()}`,
            type: 'pattern',
            pattern: pattern,
            correctIndex: oddIndex,
            answer: oddIndex.toString(),
            instructions: 'Click on the one square that is different from all the others in the grid.',
            gridSize: gridSize,
            timeLimit: 70
        };
    }
    
    static render(challenge, container) {
        if (!container) return;
        
        const grid = document.createElement('div');
        grid.className = 'pattern-grid';
        grid.style.gridTemplateColumns = `repeat(${challenge.gridSize}, 1fr)`;
        
        challenge.pattern.forEach((color, index) => {
            const item = document.createElement('div');
            item.className = 'pattern-item';
            const r = color.r.toString(16).padStart(2, '0').toUpperCase();
            const g = color.g.toString(16).padStart(2, '0').toUpperCase();
            const b = color.b.toString(16).padStart(2, '0').toUpperCase();
            item.style.backgroundColor = `#${r}${g}${b}`;
            item.dataset.index = index;
            item.addEventListener('click', () => {
                grid.querySelectorAll('.pattern-item').forEach(i => {
                    i.classList.remove('selected');
                    i.style.borderWidth = '';
                    i.style.outline = '';
                    i.style.outlineOffset = '';
                    i.style.zIndex = '';
                    i.style.position = '';
                });
                item.classList.add('selected');
                item.style.borderColor = 'var(--primary-color)';
                item.style.borderWidth = '6px';
                item.style.outline = '4px solid rgba(37, 99, 235, 0.8)';
                item.style.outlineOffset = '3px';
                item.style.zIndex = '10';
                item.style.position = 'relative';
            });
            grid.appendChild(item);
        });
        
        container.appendChild(grid);
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
        
        const selected = challengeEl.querySelector('.pattern-item.selected');
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
        const patternItems = challengeEl.querySelectorAll('.pattern-item');
        patternItems.forEach((item, index) => {
            if (index === challenge.correctIndex) {
                item.classList.add('selected');
                item.style.borderColor = 'var(--success-color)';
                item.style.borderWidth = '6px';
                item.style.outline = '4px solid rgba(16, 185, 129, 0.8)';
                item.style.outlineOffset = '3px';
                item.style.zIndex = '10';
                item.style.position = 'relative';
            }
        });
    }
}

