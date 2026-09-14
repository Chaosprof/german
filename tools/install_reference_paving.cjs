'use strict';
// Embed the production paving source for offline and restricted-preview builds.
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'berlin-runner.html');
let html = fs.readFileSync(file, 'utf8');
const data = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(root, 'assets/img/berlin-reference-paving-v2.jpg')).toString('base64');
const marker = '  // BEGIN REFERENCE PAVING IMAGE';
const block = marker + '\n  var BERLIN_REFERENCE_PAVING_IMAGE = ' + JSON.stringify(data) + ';\n  // END REFERENCE PAVING IMAGE';
if (html.includes(marker)) html = html.replace(/  \/\/ BEGIN REFERENCE PAVING IMAGE[\s\S]*?  \/\/ END REFERENCE PAVING IMAGE/, () => block);
else {
  const anchor = '  // Generated slate retains the shared road draw and procedural fallback.';
  assert.ok(html.includes(anchor));
  html = html.replace(anchor, () => block + '\n' + anchor);
}
assert.equal((html.match(/texLoader.load\(BERLIN_REFERENCE_PAVING_IMAGE,/g) || []).length, 1);
fs.writeFileSync(file, html);
console.log('Embedded reference paving JPEG: ' + Buffer.byteLength(data) + ' bytes.');
