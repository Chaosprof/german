'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'berlin-runner.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const source = fs.readFileSync(path.join(__dirname, 'berlin_kiez_kit.js'), 'utf8')
  .replace(/\nif \(typeof module[^\n]+\n?$/, '\n');
const start = '  // BEGIN AUTHORED KIEZ KIT';
const end = '  // END AUTHORED KIEZ KIT';
const block = start + '\n' + source + '\n' + end;
if (html.includes(start)) {
  const a = html.indexOf(start), b = html.indexOf(end, a) + end.length;
  html = html.slice(0, a) + block + html.slice(b);
} else {
  html = html.replace('  function makeBuilding(side) {', block + '\n\n  function makeBuilding(side) {');
}
fs.writeFileSync(htmlPath, html);
console.log('Embedded the Kiez architecture factory.');
