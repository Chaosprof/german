// Run with: node tools/check_berlin_graphics.cjs
// Tests the actual embedded geometry merger, including its canopy-color path.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'berlin-runner.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
scripts.forEach((source, i) => new vm.Script(source, {filename:`inline-${i}.js`}));
const context = vm.createContext({console});
vm.runInContext(scripts.find(s => s.includes('three.js r156 (MIT)')), context);
const THREE = context.THREE;
const begin = html.indexOf('  function mergeBoxes(specs) {');
const end = html.indexOf('\n  // DRAW-CALL CONSOLIDATION:', begin);
const merge = new Function('THREE', html.slice(begin, end) + '\nreturn mergeBoxes;')(THREE);
const colored = new THREE.BoxGeometry(1, 1, 1);
const colors = new Uint16Array(colored.attributes.position.count * 3);
for (let i = 0; i < colors.length; i += 3) { colors[i] = 32768; colors[i+1] = 65535; colors[i+2] = 16384; }
colored.setAttribute('color', new THREE.Uint16BufferAttribute(colors, 3, true));
const originalX = colored.attributes.position.getX(0);
const plain = new THREE.BoxGeometry(1, 1, 1);
const result = merge([{geo:colored, x:3}, {geo:plain}]);
assert.equal(result.attributes.position.count, 72);
assert.equal(result.attributes.color.count, 72);
assert.ok(Math.abs(result.attributes.color.getX(0) - 32768 / 65535) < 1e-6);
assert.equal(result.attributes.color.getY(0), 1);
assert.equal(result.attributes.color.getX(36), 1);
assert.equal(result.attributes.position.getX(0), originalX + 3);
assert.equal(colored.attributes.position.getX(0), originalX, 'shared input geometry must remain unchanged');
assert.equal(merge([{geo:plain}]).attributes.color, undefined, 'plain batches must not allocate unused colors');
assert.ok(result.boundingSphere && Number.isFinite(result.boundingSphere.radius));
console.log(`PASS: ${scripts.length} scripts parse; indexed/normalized colors, mixed uncolored geometry, transforms, source ownership, and bounds.`);
