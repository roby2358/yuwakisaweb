// Sprite Loader Utility
class SpriteLoader {
    static async loadSpriteSheet(src, gridSize = 4) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                const spriteWidth = img.width / gridSize;
                const spriteHeight = img.height / gridSize;
                const sprites = [];
                
                for (let row = 0; row < gridSize; row++) {
                    for (let col = 0; col < gridSize; col++) {
                        const spriteCanvas = document.createElement('canvas');
                        spriteCanvas.width = spriteWidth;
                        spriteCanvas.height = spriteHeight;
                        const spriteCtx = spriteCanvas.getContext('2d');
                        spriteCtx.drawImage(
                            canvas,
                            col * spriteWidth,
                            row * spriteHeight,
                            spriteWidth,
                            spriteHeight,
                            0,
                            0,
                            spriteWidth,
                            spriteHeight
                        );
                        sprites.push(spriteCanvas);
                    }
                }
                
                resolve({
                    sprites: sprites,
                    width: spriteWidth,
                    height: spriteHeight
                });
            };
            img.onerror = reject;
            img.src = src;
        });
    }
}

// Predator Challenge Implementation
class PredatorChallenge {
    static predatorSheet = null;
    static safeSheet = null;
    
    static async initialize() {
        if (!this.predatorSheet) {
            this.predatorSheet = await SpriteLoader.loadSpriteSheet('predator_sprites.png', 4);
        }
        if (!this.safeSheet) {
            this.safeSheet = await SpriteLoader.loadSpriteSheet('safe_sprites.png', 4);
        }
    }
    
    static randn(a, b) {
        return Math.floor(Math.random() * (b - a)) + a;
    }
    
    static shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = this.randn(0, i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    static async generate() {
        await this.initialize();
        
        const predatorSprites = this.predatorSheet.sprites;
        const safeSprites = this.safeSheet.sprites;
        
        const selectedPredators = [];
        const selectedSafe = [];
        
        const predatorIndices = [];
        for (let i = 0; i < predatorSprites.length; i++) {
            predatorIndices.push(i);
        }
        const shuffledPredators = this.shuffleArray(predatorIndices);
        
        for (let i = 0; i < 7; i++) {
            const index = shuffledPredators[i];
            selectedPredators.push({
                sprite: predatorSprites[index],
                isSafe: false,
                originalIndex: index
            });
        }
        
        const safeIndices = [];
        for (let i = 0; i < safeSprites.length; i++) {
            safeIndices.push(i);
        }
        const shuffledSafe = this.shuffleArray(safeIndices);
        
        for (let i = 0; i < 3; i++) {
            const index = shuffledSafe[i];
            selectedSafe.push({
                sprite: safeSprites[index],
                isSafe: true,
                originalIndex: index
            });
        }
        
        const allSprites = [...selectedPredators, ...selectedSafe];
        const shuffledAll = this.shuffleArray(allSprites);
        
        const correctIndices = [];
        shuffledAll.forEach((sprite, index) => {
            if (sprite.isSafe) {
                correctIndices.push(index);
            }
        });
        
        const sortedIndices = correctIndices.sort((a, b) => a - b);
        
        return {
            id: `predator-${Date.now()}`,
            type: 'predator',
            sprites: shuffledAll,
            correctIndices: sortedIndices,
            answer: sortedIndices.join(','),
            instructions: 'Click on the predators that are safe to approach.',
            explanation: 'Biological intelligences are constantly carefully negotiating with the presence of dangerous predators',
            timeLimit: 75
        };
    }
    
    static render(challenge, container) {
        if (!container) return;
        
        const spriteGrid = document.createElement('div');
        spriteGrid.className = 'predator-grid';
        spriteGrid.style.cssText = 'display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin: 2rem 0; max-width: 600px; margin-left: auto; margin-right: auto;';
        
        challenge.sprites.forEach((spriteData, index) => {
            const spriteDiv = document.createElement('div');
            spriteDiv.className = 'predator-sprite';
            spriteDiv.dataset.index = index;
            spriteDiv.dataset.isSafe = spriteData.isSafe;
            spriteDiv.style.cssText = `
                width: 100px;
                height: 100px;
                border: 3px solid transparent;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.05);
                position: relative;
            `;
            
            const img = document.createElement('img');
            img.src = spriteData.sprite.toDataURL();
            img.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain;';
            img.style.pointerEvents = 'none';
            spriteDiv.appendChild(img);
            
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
                
                const isSelected = spriteDiv.classList.contains('selected');
                if (isSelected) {
                    spriteDiv.classList.remove('selected');
                    spriteDiv.style.borderColor = 'transparent';
                    spriteDiv.style.borderWidth = '3px';
                    spriteDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                    spriteDiv.style.outline = '';
                    spriteDiv.style.outlineOffset = '';
                    spriteDiv.style.zIndex = '';
                    spriteDiv.style.position = '';
                } else {
                    spriteDiv.classList.add('selected');
                    spriteDiv.style.borderColor = 'var(--primary-color)';
                    spriteDiv.style.borderWidth = '6px';
                    spriteDiv.style.backgroundColor = 'rgba(37, 99, 235, 0.3)';
                    spriteDiv.style.outline = '4px solid rgba(37, 99, 235, 0.8)';
                    spriteDiv.style.outlineOffset = '3px';
                    spriteDiv.style.zIndex = '10';
                    spriteDiv.style.position = 'relative';
                }
            };
            
            spriteDiv.addEventListener('click', handleSelection);
            spriteDiv.addEventListener('touchend', handleSelection, { passive: false });
            
            spriteDiv.addEventListener('mouseenter', () => {
                if (!spriteDiv.classList.contains('selected')) {
                    spriteDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
                }
            });
            
            spriteDiv.addEventListener('mouseleave', () => {
                if (!spriteDiv.classList.contains('selected')) {
                    spriteDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                }
            });
            
            spriteGrid.appendChild(spriteDiv);
        });
        
        container.appendChild(spriteGrid);
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
        
        const selected = challengeEl.querySelectorAll('.predator-sprite.selected');
        const indices = Array.from(selected)
            .map(el => {
                const index = parseInt(el.dataset.index);
                return isNaN(index) ? null : index;
            })
            .filter(index => index !== null)
            .sort((a, b) => a - b);
        return indices.join(',');
    }
    
    static revealAnswer(challenge, challengeEl) {
        const sprites = challengeEl.querySelectorAll('.predator-sprite');
        sprites.forEach((sprite, index) => {
            if (challenge.correctIndices.includes(index)) {
                sprite.classList.add('selected');
                sprite.style.borderColor = 'var(--success-color)';
                sprite.style.borderWidth = '6px';
                sprite.style.backgroundColor = 'rgba(16, 185, 129, 0.3)';
                sprite.style.outline = '4px solid rgba(16, 185, 129, 0.8)';
                sprite.style.outlineOffset = '3px';
                sprite.style.zIndex = '10';
                sprite.style.position = 'relative';
            }
        });
    }
}

