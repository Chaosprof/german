'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const html = fs.readFileSync(path.join(__dirname, '../berlin-runner.html'), 'utf8');
const c = vm.createContext({ console });
vm.runInContext([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(m => m[1]).find(s => s.includes('three.js r156 (MIT)')), c);
const T = c.THREE;
c.MathU = T.MathUtils; c.contactTex = new T.Texture(); c.scene = new T.Scene();
c.visualPlayer = { x: 3, y: 0, z: 1700 };
const groundRotation = new T.Quaternion(), groundAnchor = new T.Vector3();
c.applyPlayerFrame = (object, x, y, z) => {
  object.position.copy(groundAnchor).add(new T.Vector3(x, y, z).applyQuaternion(groundRotation));
  object.quaternion.copy(groundRotation).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2));
};
const start = html.indexOf('  var runnerFootAO = ');
const end = html.indexOf('  // Soft, deliberately art-directed glow', start);
assert.ok(start > 0 && end > start);
vm.runInContext(html.slice(start, end), c);
const mesh = c.runnerFootAO, originalBuffer = mesh.instanceMatrix.array;
assert.ok(mesh.isInstancedMesh && mesh.count === 2 && !mesh.castShadow);
assert.ok(mesh.material.blending === T.MultiplyBlending && !mesh.material.depthWrite);
assert.equal(c.scene.children.length, 1, 'both feet share one scene submission');
let cases = 0;
for (const [pitch, yaw, bank] of [[0,0,0], [.08,.22,-.06], [-.11,-.4,.09]]) {
  groundRotation.setFromEuler(new T.Euler(pitch,yaw,bank));
  groundAnchor.set(12,2,-1400);
  const normal = new T.Vector3(0,1,0).applyQuaternion(groundRotation);
  const floor = groundAnchor.clone().add(new T.Vector3(3,.042,1700).applyQuaternion(groundRotation));
  for (const [leftHeight,rightHeight] of [[.1,.46],[.46,.1],[.1,.1],[.32,.32],[.8,1.1]]) {
    const feet = [new T.Vector3(-.2,leftHeight,-.34), new T.Vector3(.22,rightHeight,.41)]
      .map(v => v.applyQuaternion(groundRotation).add(floor));
    c.updateRunnerFootContact(...feet);
    assert.equal(mesh.visible, leftHeight < .54 || rightHeight < .54);
    for (let i=0; i<2; i++) {
      const matrix = new T.Matrix4(); mesh.getMatrixAt(i,matrix);
      assert.ok(matrix.elements.every(Number.isFinite));
      const centre = new T.Vector3().setFromMatrixPosition(matrix);
      assert.ok(Math.abs(centre.clone().sub(floor).dot(normal)) < .0002, 'contact lies on the banked ground');
      const expected = feet[i].clone().addScaledVector(normal, -[leftHeight,rightHeight][i]);
      assert.ok(centre.distanceTo(expected) < .0002, 'contact remains directly beneath the animated shoe');
      const scale = new T.Vector3().setFromMatrixScale(matrix);
      assert.ok(scale.x >= 0 && scale.x <= 1.00001 && scale.y <= 1.00001, 'contact never spreads beyond its shoe-sized bounds');
      if ([leftHeight,rightHeight][i] >= .54) assert.ok(scale.x < .00001, 'airborne feet leave no contact decal');
    }
    assert.equal(mesh.instanceMatrix.array,originalBuffer,'animation reuses its two-instance buffer');
    cases++;
  }
}
console.log(`PASS: ${cases} planted/alternating/landing/airborne cases on flat and banked roads; exact shoe projection, finite bounded contacts and one reused two-instance draw.`);
