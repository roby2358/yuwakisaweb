// Ball physics for the flow-field visualization: no DOM, no noise — takes
// an angleAt(x, y) function supplied by the caller (field.js's sampler).

function createBall(x, y, color, radius) {
    return { x, y, vx: 0, vy: 0, color, radius };
}

// Advances one ball by dt seconds: the flow field pushes it as a constant
// acceleration along the local line direction, a tiny random acceleration
// (Brownian-like jitter, magnitude `jitter`, drawn from `randomFn`) nudges it
// off the flow line, a slight linear drag opposes its velocity (so speed
// settles instead of growing forever), then it bounces elastically off the
// canvas edges (velocity component flips, no energy loss). `randomFn` is
// injected (rather than calling Math.random directly) so callers can supply
// a seeded or fixed source for deterministic tests.
function stepBall(ball, angleAt, accel, drag, jitter, randomFn, dt, width, height) {
    const angle = angleAt(ball.x, ball.y);
    const jitterX = jitter * (randomFn() * 2 - 1);
    const jitterY = jitter * (randomFn() * 2 - 1);
    const vx = ball.vx + (Math.cos(angle) * accel + jitterX - drag * ball.vx) * dt;
    const vy = ball.vy + (Math.sin(angle) * accel + jitterY - drag * ball.vy) * dt;

    let x = ball.x + vx * dt;
    let y = ball.y + vy * dt;
    let nx = vx;
    let ny = vy;

    if (x < ball.radius) {
        x = ball.radius;
        nx = -nx;
    } else if (x > width - ball.radius) {
        x = width - ball.radius;
        nx = -nx;
    }

    if (y < ball.radius) {
        y = ball.radius;
        ny = -ny;
    } else if (y > height - ball.radius) {
        y = height - ball.radius;
        ny = -ny;
    }

    return Object.assign({}, ball, { x, y, vx: nx, vy: ny });
}

// Keeps a ball inside a resized canvas (e.g. after Regenerate changes
// width/height) without touching its velocity.
function clampBallPosition(ball, width, height) {
    return Object.assign({}, ball, {
        x: Math.min(Math.max(ball.x, ball.radius), width - ball.radius),
        y: Math.min(Math.max(ball.y, ball.radius), height - ball.radius),
    });
}
