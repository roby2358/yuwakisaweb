// Loads the plain-script game sources into globals for headless tests.
var fs = require('fs'), path = require('path');
var names = { vec: 'Vec', rng: 'Rng', track: 'Track', mesh: 'Mesh', scene: 'Scene', camera: 'Camera', render: 'Render', cars: 'Cars' };
for (var f in names) eval(fs.readFileSync(path.join(__dirname, '..', f + '.js'), 'utf8') + ';global.' + names[f] + '=' + names[f]);
