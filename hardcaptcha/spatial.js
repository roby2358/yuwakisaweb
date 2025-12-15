// Spatial Challenge Implementation

class SpatialChallenge {
    static randn(a, b) {
        return Math.floor(Math.random() * (b - a)) + a;
    }

    static getShapeFamilies() {
        // Each family has four oriented glyphs covering cardinal directions without rotational collisions.
        return [
            ['▲', '▶', '▼', '◀'],      // triangles
            ['┌', '┐', '┘', '└'],      // corner brackets
            ['◤', '◥', '◢', '◣'],      // wedges
            ['↥', '↦', '↧', '↤']       // thin arrows
        ];
    }

    static getRotations() {
        return [0, 90, 180, 270];
    }

    static generate() {
        const rotations = this.getRotations();
        const correctRotation = rotations[this.randn(0, rotations.length)];
        const isClockwise = Math.random() < 0.5;
        let correctShape;
        let options;

        // 10% chance to use rotationally symmetric shape (circle or square)
        if (Math.random() < 0.1) {
            const symmetricShapes = ['●', '■'];
            correctShape = symmetricShapes[this.randn(0, symmetricShapes.length)];
            
            // Create options: correct shape + 3 random shapes from other families
            const families = this.getShapeFamilies();
            options = [{ shape: correctShape, rotation: correctRotation, correct: true }];
            
            // Collect all shapes from all families
            const allShapes = families.flat();
            for (let i = 0; i < 3; i++) {
                const randomShape = allShapes[this.randn(0, allShapes.length)];
                options.push({ shape: randomShape, rotation: correctRotation, correct: false });
            }
        } else {
            // Normal case: pick a family and use all 4 shapes from that family
            const families = this.getShapeFamilies();
            const shapes = families[this.randn(0, families.length)];
            correctShape = shapes[this.randn(0, shapes.length)];
            options = shapes.map((shape) => ({
                shape,
                rotation: correctRotation,
                correct: shape === correctShape
            }));
        }

        // Shuffle options
        for (let i = options.length - 1; i > 0; i--) {
            const j = this.randn(0, i + 1);
            const temp = options[i];
            options[i] = options[j];
            options[j] = temp;
        }

        const correctIndex = options.findIndex((opt) => opt.correct);

        const direction = isClockwise ? 'clockwise' : 'counter-clockwise';

        return {
            id: `spatial-${Date.now()}`,
            type: 'spatial',
            targetShape: correctShape,
            targetRotation: correctRotation,
            isClockwise: isClockwise,
            options: options,
            correctIndex: correctIndex,
            answer: correctIndex.toString(),
            instructions: `Select the shape ${correctShape} rotated ${correctRotation} degrees ${direction}:`,
            explanation: 'Embodied intelligences needed to turn and navigate physical spaces.',
            timeLimit: 60
        };
    }

    static render(challenge, container) {
        if (!container) {
            return;
        }

        const spatialDiv = document.createElement('div');
        spatialDiv.className = 'spatial-container';

        challenge.options.forEach((option, index) => {
            const shapeDiv = document.createElement('div');
            shapeDiv.className = 'shape';
            shapeDiv.dataset.index = index;
            const rotationValue = challenge.isClockwise ? option.rotation : -option.rotation;
            shapeDiv.style.transform = `rotate(${rotationValue}deg)`;
            shapeDiv.textContent = option.shape;
            shapeDiv.addEventListener('click', () => {
                const challengeRoot = document.getElementById(challenge.id);
                if (!challengeRoot) {
                    return;
                }
                challengeRoot.querySelectorAll('.shape').forEach((shape) => {
                    shape.classList.remove('selected');
                    shape.style.borderColor = '';
                    shape.style.backgroundColor = '';
                });
                shapeDiv.classList.add('selected');
            });
            spatialDiv.appendChild(shapeDiv);
        });

        container.appendChild(spatialDiv);
    }

    static getAnswer(challenge) {
        const challengeEl = document.getElementById(challenge.id);
        if (!challengeEl) {
            return '';
        }
        const container = document.getElementById('challengesContainer');
        if (!container || !container.contains(challengeEl)) {
            return '';
        }
        const selectedShape = challengeEl.querySelector('.shape.selected');
        if (!selectedShape) {
            return '';
        }
        return selectedShape.dataset.index || '';
    }

    static revealAnswer(challenge, challengeEl) {
        if (!challengeEl) {
            return;
        }
        const spatialShapes = challengeEl.querySelectorAll('.shape');
        spatialShapes.forEach((shape, index) => {
            if (index === challenge.correctIndex) {
                shape.classList.add('selected');
                shape.style.borderColor = 'var(--success-color)';
                shape.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
            }
        });
    }
}

if (typeof module !== 'undefined') {
    module.exports = SpatialChallenge;
}

