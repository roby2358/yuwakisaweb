const assert = require('assert');
const test = require('node:test');
const SpatialChallenge = require('../spatial.js');

test('spatial challenge generation produces a single correct option', () => {
    const challenge = SpatialChallenge.generate();

    assert.strictEqual(challenge.type, 'spatial');
    assert.strictEqual(challenge.options.length, 4);

    const correctOptions = challenge.options.filter((opt) => opt.correct);
    assert.strictEqual(correctOptions.length, 1);
    assert.strictEqual(challenge.answer, challenge.correctIndex.toString());

    const rotationSet = new Set(challenge.options.map((opt) => opt.rotation));
    assert.strictEqual(rotationSet.size, 1, 'All options share the same rotation');

    const correct = challenge.options[challenge.correctIndex];
    assert.ok(correct, 'Correct option must exist at correctIndex');
    assert.strictEqual(correct.shape, challenge.targetShape);
    assert.strictEqual(correct.rotation, challenge.targetRotation);

    assert.strictEqual(typeof challenge.isClockwise, 'boolean', 'isClockwise must be a boolean');
    
    const expectedDirection = challenge.isClockwise ? 'clockwise' : 'counter-clockwise';
    assert.ok(
        typeof challenge.instructions === 'string' &&
        challenge.instructions.includes(challenge.targetShape) &&
        challenge.instructions.includes(challenge.targetRotation.toString()) &&
        challenge.instructions.includes(expectedDirection),
        'Instructions must reference target shape, rotation, and direction'
    );

    // Check if symmetric mode (circle or square) or normal mode
    const symmetricShapes = ['●', '■'];
    const hasSymmetric = challenge.options.some((opt) => symmetricShapes.includes(opt.shape));
    
    if (hasSymmetric) {
        // Symmetric mode: one should be circle/square, others from other families
        const symmetricCount = challenge.options.filter((opt) => symmetricShapes.includes(opt.shape)).length;
        assert.strictEqual(symmetricCount, 1, 'Symmetric mode should have exactly one circle/square');
        assert.ok(symmetricShapes.includes(challenge.targetShape), 'Target should be circle or square in symmetric mode');
    } else {
        // Normal mode: all shapes should come from one family
        const families = SpatialChallenge.getShapeFamilies();
        const inFamily = families.some((fam) => challenge.options.every((opt) => fam.includes(opt.shape)));
        assert.ok(inFamily, 'All shapes should come from one family in normal mode');
    }
});

