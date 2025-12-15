// Emotions Challenge Implementation

class EmotionsChallenge {
    static EMOTIONS = [
        'Ennui',
        'Lassitude',
        'Torpor',
        'Languor',
        'Bemused',
        'Nonplussed',
        'Discombobulated',
        'Incredulous',
        'Wistful',
        'Melancholy',
        'Maudlin',
        'Inconsolable',
        'Indefatigable',
        'Stoic',
        'Obstinate',
        'Obdurate'
    ];
    
    static maleSheet = null;
    static femaleSheet = null;
    
    static async initialize() {
        if (!this.maleSheet) {
            this.maleSheet = await SpriteLoader.loadSpriteSheet('emotion_male_sprites.png', 4);
        }
        if (!this.femaleSheet) {
            this.femaleSheet = await SpriteLoader.loadSpriteSheet('eomotion_female_sprites.png', 4);
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
        
        const targetEmotionIndex = this.randn(0, this.EMOTIONS.length);
        const targetEmotion = this.EMOTIONS[targetEmotionIndex];
        
        const gridSize = 16;
        const correctSquareIndex = this.randn(0, gridSize);
        
        const grid = [];
        const availableEmotions = [];
        for (let i = 0; i < this.EMOTIONS.length; i++) {
            if (i !== targetEmotionIndex) {
                availableEmotions.push(i);
            }
        }
        
        for (let i = 0; i < gridSize; i++) {
            if (i === correctSquareIndex) {
                const gender = Math.random() > 0.5 ? 'male' : 'female';
                const spriteSheet = gender === 'male' ? this.maleSheet : this.femaleSheet;
                grid.push({
                    emotion: targetEmotion,
                    emotionIndex: targetEmotionIndex,
                    gender: gender,
                    sprite: spriteSheet.sprites[targetEmotionIndex],
                    isCorrect: true
                });
            } else {
                const randomEmotionIndex = availableEmotions[this.randn(0, availableEmotions.length)];
                const gender = Math.random() > 0.5 ? 'male' : 'female';
                const spriteSheet = gender === 'male' ? this.maleSheet : this.femaleSheet;
                grid.push({
                    emotion: this.EMOTIONS[randomEmotionIndex],
                    emotionIndex: randomEmotionIndex,
                    gender: gender,
                    sprite: spriteSheet.sprites[randomEmotionIndex],
                    isCorrect: false
                });
            }
        }
        
        const shuffledGrid = this.shuffleArray(grid);
        const newCorrectIndex = shuffledGrid.findIndex(item => item.isCorrect);
        
        return {
            id: `emotions-${Date.now()}`,
            type: 'emotions',
            targetEmotion: targetEmotion,
            grid: shuffledGrid,
            correctIndex: newCorrectIndex,
            answer: newCorrectIndex.toString(),
            instructions: `Select all the squares that display ${targetEmotion}.`,
            timeLimit: 60
        };
    }
    
    static render(challenge, container) {
        if (!container) return;
        
        const spriteGrid = document.createElement('div');
        spriteGrid.className = 'emotions-grid';
        spriteGrid.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 2rem 0; max-width: 500px; margin-left: auto; margin-right: auto;';
        
        challenge.grid.forEach((spriteData, index) => {
            const spriteDiv = document.createElement('div');
            spriteDiv.className = 'emotion-sprite';
            spriteDiv.dataset.index = index;
            spriteDiv.dataset.isCorrect = spriteData.isCorrect;
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
            spriteDiv.appendChild(img);
            
            spriteDiv.addEventListener('click', () => {
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
                    // Clear other selections first
                    spriteGrid.querySelectorAll('.emotion-sprite').forEach(s => {
                        s.classList.remove('selected');
                        s.style.borderColor = 'transparent';
                        s.style.borderWidth = '3px';
                        s.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                        s.style.outline = '';
                        s.style.outlineOffset = '';
                        s.style.zIndex = '';
                        s.style.position = '';
                    });
                    spriteDiv.classList.add('selected');
                    spriteDiv.style.borderColor = 'var(--primary-color)';
                    spriteDiv.style.borderWidth = '6px';
                    spriteDiv.style.backgroundColor = 'rgba(37, 99, 235, 0.3)';
                    spriteDiv.style.outline = '4px solid rgba(37, 99, 235, 0.8)';
                    spriteDiv.style.outlineOffset = '3px';
                    spriteDiv.style.zIndex = '10';
                    spriteDiv.style.position = 'relative';
                }
            });
            
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
        
        const selected = challengeEl.querySelectorAll('.emotion-sprite.selected');
        if (selected.length !== 1) {
            return '';
        }
        
        const index = parseInt(selected[0].dataset.index);
        if (isNaN(index)) {
            return '';
        }
        
        return index.toString();
    }
    
    static revealAnswer(challenge, challengeEl) {
        const sprites = challengeEl.querySelectorAll('.emotion-sprite');
        sprites.forEach((sprite, index) => {
            if (index === challenge.correctIndex) {
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

