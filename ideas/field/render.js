// Pure drawing: takes the points generateField() produced and paints them.
// No noise math lives here, so a curl-noise or flow-map generator could be
// dropped in without touching this file.

// Dispatch table: color mode -> stroke color for one point. Adding a new
// coloring is one entry here plus an <option> in index.html.
const STROKE_COLORS = {
    none(pt, params) {
        return params.lineColor;
    },
    direction(pt, params) {
        const hue = ((pt.angle + Math.PI) / (2 * Math.PI)) * 360;
        return `hsl(${hue.toFixed(1)}, 75%, 72%)`;
    },
    magnitude(pt, params) {
        const t = (pt.magnitude + 1) / 2; // magnitude is roughly [-1, 1]
        const lightness = 35 + t * 55;
        return `hsl(45, 25%, ${lightness.toFixed(1)}%)`;
    },
};

function renderField(ctx, points, params) {
    const strokeColor = STROKE_COLORS[params.colorMode];

    ctx.save();
    ctx.fillStyle = params.backgroundColor;
    ctx.fillRect(0, 0, params.width, params.height);

    ctx.lineCap = 'round';
    ctx.lineWidth = params.lineThickness;

    const halfLen = params.lineLength / 2;
    for (const pt of points) {
        const dx = Math.cos(pt.angle) * halfLen;
        const dy = Math.sin(pt.angle) * halfLen;
        ctx.strokeStyle = strokeColor(pt, params);
        ctx.beginPath();
        ctx.moveTo(pt.x - dx, pt.y - dy);
        ctx.lineTo(pt.x + dx, pt.y + dy);
        ctx.stroke();
    }
    ctx.restore();
}
