'use strict';
// Default: stage and validate, with no canonical source writes.
// Explicit --apply / --revert install or undo only the exact local snippets.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const stage = path.join(root, 'audit/berlin-bakery-shadows-v96');
const files = [
  {name: 'berlin-runner.html',
    before: '        treeZ = i === 0 ? -8 : i === 1 ? -2 : i === 2 ? 10.5 : 4;',
    after: '        treeZ = i === 0 ? -8 : i === 1 ? -2 : i === 2 ? 10.5 : -15;'},
  {name: 'tools/check_berlin_reference_composition.cjs',
    before: 'let minimumPitRoadClearance = Infinity, maximumPitFacadeReach = -Infinity;',
    after: "assert.deepEqual(trees.map(tree => tree.position.z), [-8, -2, 10.5, -15],\n"+
      "  'reference trees retain the recurring stagger and the foreground index-2 anchor');\n"+
      'let minimumPitRoadClearance = Infinity, maximumPitFacadeReach = -Infinity;'}
];
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function snippet(text, value) { return value.replace(/\n/g, text.includes('\r\n') ? '\r\n' : '\n'); }
function replace(text, from, to, filename) {
  from = snippet(text, from); to = snippet(text, to);
  const index = text.indexOf(from);
  assert.ok(index >= 0 && text.indexOf(from, index + from.length) < 0,
    'Exactly one source anchor required in '+filename+'; refusing an uncertain replacement');
  return text.slice(0, index)+to+text.slice(index+from.length);
}
function transform(text, file, reverse) {
  if (!reverse) return replace(text, file.before, file.after, file.name);
  // The test's before text is a suffix of its after text, so match the complete
  // inserted assertion for reversal rather than using a partial marker.
  return replace(text, file.after, file.before, file.name);
}
function write(target, value) {
  fs.mkdirSync(path.dirname(target), {recursive: true}); fs.writeFileSync(target, value);
}
const mode = process.argv.includes('--apply') ? 'apply' : process.argv.includes('--revert') ? 'revert' : 'stage';
assert.ok(!(process.argv.includes('--apply') && process.argv.includes('--revert')), 'Choose apply or revert, never both');
if (mode !== 'stage') {
  // Validate both inputs before changing either one. Preserve unrelated edits
  // (including the independently tested facade material) and all line endings.
  const pending = files.map(file => {
    const target = path.join(root, file.name), old = fs.readFileSync(target, 'utf8');
    const already = snippet(old, mode === 'apply' ? file.after : file.before);
    const marker = snippet(old, mode === 'apply' ? file.before : file.after);
    const stateAlready = mode === 'apply' ? old.includes(already) : !old.includes(marker) && old.includes(already);
    return {target, name:file.name, old, next:stateAlready ? old : transform(old, file, mode === 'revert')};
  });
  for (const file of pending) if (file.old !== file.next) fs.writeFileSync(file.target, file.next);
  console.log(JSON.stringify({mode, changed:pending.filter(f => f.old !== f.next).map(f => f.name),
    untouchedOutsideExactSnippets:true}, null, 2));
  process.exit(0);
}

fs.mkdirSync(stage, {recursive: true});
const baselineHashes = {}, candidateHashes = {};
for (const file of files) {
  const source = path.join(root, file.name), baseline = path.join(stage, 'baseline', file.name);
  if (!fs.existsSync(baseline)) write(baseline, fs.readFileSync(source));
  const old = fs.readFileSync(baseline, 'utf8'), candidate = transform(old, file, false);
  assert.equal(transform(candidate, file, true), old, 'Exact apply/revert round trip');
  baselineHashes[file.name] = sha(Buffer.from(old)); candidateHashes[file.name] = sha(Buffer.from(candidate));
  write(path.join(stage, 'source', file.name), candidate);
}
const manifestPath = path.join(stage, 'baseline/sha256.json');
if (fs.existsSync(manifestPath)) assert.deepEqual(JSON.parse(fs.readFileSync(manifestPath)), baselineHashes);
else write(manifestPath, JSON.stringify(baselineHashes, null, 2)+'\n');
write(path.join(stage, 'exact-edits.json'), JSON.stringify({files, baselineHashes, candidateHashes}, null, 2)+'\n');
const canonicalHashes = Object.fromEntries(files.map(file => [file.name, sha(fs.readFileSync(path.join(root, file.name)))]));

// Execute the existing composition/culling test with only its HTML read
// redirected to the staged source. Assets and shared factories remain the
// actual canonical files; no browser, capture, or alternate renderer is used.
const stagedHtml = fs.readFileSync(path.join(stage, 'source/berlin-runner.html'), 'utf8');
const testSource = fs.readFileSync(path.join(stage, 'source/tools/check_berlin_reference_composition.cjs'), 'utf8');
const localFs = Object.create(fs);
localFs.readFileSync = function (name, ...args) {
  if (typeof name === 'string' && path.resolve(name) === path.join(root, 'berlin-runner.html'))
    return args[0] ? stagedHtml : Buffer.from(stagedHtml);
  return fs.readFileSync(name, ...args);
};
localFs.writeFileSync = function () { throw new Error('Existing test attempted an unexpected write'); };
const localRequire = name => name === 'fs' ? localFs : require(name);
const testMessages = [];
const execute = new Function('require', '__dirname', 'process', 'console', testSource+
  '\nreturn {T,trees,newTrees,opening,report,treeWanted,treeViewProfiles,margin};');
const fixture = execute(localRequire, path.join(root, 'tools'), {argv:['node','staged-composition-test'],env:process.env},
  {log: message => testMessages.push(String(message))});
write(path.join(stage, 'composition.json'), JSON.stringify(fixture.report, null, 2)+'\n');
write(path.join(stage, 'composition.log'), testMessages.join('\n')+'\n');

const {T, trees, newTrees, opening, treeWanted, treeViewProfiles, margin} = fixture;
const lightDirection = new T.Vector3(-62,75,-23).normalize();
assert.ok(stagedHtml.includes('sun.position.set(routePointX - 62, routePointY + 75, routePointZ - 9)'));
assert.ok(stagedHtml.includes('sampleRoutePoint(player.x, playerSurfaceY(player.z + 14), player.z + 14)'));
const originalTrees = newTrees.map((tree, index) => {
  const copy = tree.clone(true); if (index % 4 === 3) copy.position.z += 19;
  copy.updateMatrixWorld(true); return copy;
});
let rays = 0, oldHits = 0, newHits = 0; const hits = [];
for (let y=5.9;y<=8;y+=.2) for (let z=20;z<=36;z+=.3) {
  rays++; const ray = new T.Raycaster(new T.Vector3(10.84,y,z),lightDirection,0,20);
  if (ray.intersectObjects(originalTrees,true).length) oldHits++;
  if (ray.intersectObjects(newTrees,true).length) { newHits++; hits.push([y,z]); }
}
assert.equal(oldHits,0); assert.ok(newHits>0);
const openingIndex3 = trees[3], nextIndex3 = newTrees[7];
const visibility = [];
for (const profile of treeViewProfiles) {
  const camera = new T.PerspectiveCamera(profile.fov,profile.aspect,.1,350);
  camera.position.set(0,profile.height,-profile.backs[0]);camera.lookAt(0,profile.aim,profile.ahead);camera.updateMatrixWorld(true);
  const frustum = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  const view = frustum.intersectsBox(new T.Box3().setFromObject(openingIndex3));
  const wanted = treeWanted(openingIndex3,{position:{z:0}},0,-profile.backs[0]-margin);
  assert.equal(view,false);assert.equal(wanted,false);
  visibility.push({profile:profile.name,openingIndex3InView:view,openingIndex3RetainedByCull:wanted});
}
const bounds = new T.Box3().setFromObject(nextIndex3);
assert.ok(bounds.min.z >= 20 && bounds.max.z <= 60);
assert.equal(trees[2].position.z,10.5);
const projected = [];
const mesh = nextIndex3.children[0], positions = mesh.geometry.attributes.position, indices = mesh.geometry.index;
for (let i=552*3;i<indices.count;i++) {
  const p = new T.Vector3().fromBufferAttribute(positions,indices.getX(i)).applyMatrix4(mesh.matrixWorld);
  if (p.x>10.85) continue;
  const hit = p.clone().addScaledVector(new T.Vector3(62,-75,23),(10.85-p.x)/62);
  if (hit.y>0) projected.push(hit);
}
const footprint = new T.Box3().setFromPoints(projected);
const report = {stageOnly:true, recurringReferencePlacement:true,
  localTreeZ:trees.map(tree=>tree.position.z), index2Unchanged:true,
  referenceBlocksChecked:fixture.report.stagedTreeBlocks,
  existingCompositionPass:fixture.report.pass,
  existingNearRetirementChecks:fixture.report.invisibleRetirementChecks,
  openingIndex3Visibility:visibility,
  nextIndex3:{root:nextIndex3.position.toArray(), bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    projectedFacadeFootprint:{min:footprint.min.toArray(),max:footprint.max.toArray()}},
  upperWallTreeRays:{rays,before:oldHits,after:newHits,
    hitY:[Math.min(...hits.map(p=>p[0])),Math.max(...hits.map(p=>p[0]))],
    hitZ:[Math.min(...hits.map(p=>p[1])),Math.max(...hits.map(p=>p[1]))]},
  sameTreeCountGeometryMaterialsAndPools:true, exactReverseVerified:true, canonicalSourcesUntouched:true};
for (const file of files) assert.equal(sha(fs.readFileSync(path.join(root,file.name))),canonicalHashes[file.name]);
write(path.join(stage, 'validation.json'), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
