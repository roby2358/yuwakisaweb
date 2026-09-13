// Renders one frame headlessly to test/frame.png using a scanline stub of the canvas API.
// Usage: node test/frame.js [seed] [dist]
var fs = require('fs'), zlib = require('zlib'), path = require('path');
var names = { vec: 'Vec', track: 'Track', scene: 'Scene', camera: 'Camera', render: 'Render', cars: 'Cars' };
for (var f in names) eval(fs.readFileSync(path.join(__dirname, '..', f + '.js'), 'utf8') + ';global.' + names[f] + '=' + names[f]);

var W = 1200, H = 800, seed = +(process.argv[2] || 5), dist = +(process.argv[3] || 320), follow = process.argv[4] === 'follow';
var buf = Buffer.alloc(W * H * 3);
function color(hex) {
  if (hex[0] !== '#') return null;
  var n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
var pathPts = [], ctx = {
  fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
  fillRect: function () { var c = color(this.fillStyle); for (var i = 0; i < W * H; i++) { buf[i * 3] = c[0]; buf[i * 3 + 1] = c[1]; buf[i * 3 + 2] = c[2]; } },
  beginPath: function () { pathPts = []; }, moveTo: function (x, y) { pathPts.push([x, y]); }, lineTo: function (x, y) { pathPts.push([x, y]); },
  closePath: function () {}, stroke: function () {},
  fill: function () {
    var c = color(this.fillStyle); if (!c) return;
    var ys = pathPts.map(function (p) { return p[1]; });
    var y0 = Math.max(0, Math.ceil(Math.min.apply(null, ys))), y1 = Math.min(H - 1, Math.floor(Math.max.apply(null, ys)));
    for (var y = y0; y <= y1; y++) {
      var xs = [];
      for (var i = 0; i < pathPts.length; i++) {
        var a = pathPts[i], b = pathPts[(i + 1) % pathPts.length];
        if ((a[1] <= y) === (b[1] <= y)) continue;
        xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
      xs.sort(function (p, q) { return p - q; });
      for (var k = 0; k + 1 < xs.length; k += 2) {
        var xa = Math.max(0, Math.ceil(xs[k])), xb = Math.min(W - 1, Math.floor(xs[k + 1]));
        for (var x = xa; x <= xb; x++) { var o = (y * W + x) * 3; buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; }
      }
    }
  }
};

function rng(s) { return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
var scene = Scene.build(rng(seed));
var cam = new Camera(W, H); cam.dist = dist;
if (follow) { var lead = Track.at(scene, 0).pos; cam.target = Vec.make(lead.x, lead.y + 1, lead.z); }
var cars = [Cars.make(0, 58, Track.laneOffset, { body: '#e53935', roof: '#1a1a1a' }), Cars.make(-20, 64, -Track.laneOffset, { body: '#1e88e5', roof: '#1a1a1a' })];
var polys = scene.polys.slice();
cars.forEach(function (c) { polys.push.apply(polys, Cars.polys(c, scene)); });
Render.draw(ctx, cam, polys);

// Count car-colored pixels so the check is scriptable.
var red = 0, blue = 0;
for (var i = 0; i < W * H; i++) { if (buf[i * 3] === 0xe5 && buf[i * 3 + 1] === 0x39) red++; if (buf[i * 3] === 0x1e && buf[i * 3 + 1] === 0x88) blue++; }
console.log('red px', red, 'blue px', blue);

function png() {
  var raw = Buffer.alloc((W * 3 + 1) * H);
  for (var y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; buf.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
  function chunk(type, data) {
    var len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    var td = Buffer.concat([Buffer.from(type), data]);
    var crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  }
  var table = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  function crc32(b) { var c = 0xffffffff; for (var i = 0; i < b.length; i++) c = table[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  var ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
fs.writeFileSync(path.join(__dirname, 'frame.png'), png());
