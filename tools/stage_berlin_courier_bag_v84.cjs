'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),file=path.join(root,'berlin-runner.html');
let html=fs.readFileSync(file,'utf8');
const start=html.indexOf('    var bagBody = roundedBox(bagRadius * 2.45');
const end=html.indexOf('    bag.scale.setScalar(0.74);',start);
assert.ok(start>0&&end>start,'replace the known three rigid bag shells');
fs.writeFileSync(path.join(root,'audit/berlin-courier-bag-v83-baseline.js'),html.slice(start,end));
const replacement=`    // Blender-authored, closed canvas shells. Decode once; the three materials
    // are still merged into three draws by attach(), including all hardware.
    var packGeometry = dressCourierHero.packGeometry || (dressCourierHero.packGeometry = {});
    ['body', 'pocket', 'flap'].forEach(function (key) {
      var cacheKey = key + ':' + front;
      if (!packGeometry[cacheKey]) {
        var shape = decodeBerlinMeshRecord(THREE, BERLIN_COURIER_BAG_DATA.meshes[key]);
        if (front < 0) {
          shape.scale(1, 1, -1);
          var winding = shape.index.array;
          for (var i = 0; i < winding.length; i += 3) {
            var swap = winding[i + 1]; winding[i + 1] = winding[i + 2]; winding[i + 2] = swap;
          }
        }
        packGeometry[cacheKey] = shape;
      }
      var shell = new THREE.Mesh(packGeometry[cacheKey], teal);
      shell.scale.setScalar(bagRadius); shell.rotation.z = -0.12; bag.add(shell);
    });
    function bagCord(points, thickness, material) {
      var path = new THREE.CatmullRomCurve3(points.map(function (p) {
        return new THREE.Vector3(p[0]*bagRadius, p[1]*bagRadius, p[2]*bagRadius*front);
      }));
      var cord = new THREE.Mesh(new THREE.TubeGeometry(path, 16, bagRadius*thickness, 5, false), material);
      bag.add(cord); return cord;
    }
    [-1, 1].forEach(function (side) {
      bagCord([[side*0.86,-0.55,0.35],[side*1.02,0.78,0.65],
        [side*0.90,1.48,1.02],[side*0.59,1.62,0.53],[side*0.59,1.03,0.26]],0.115,navy);
    });
    function tiltPackDetail(detail) {
      detail.position.applyAxisAngle(new THREE.Vector3(0,0,1),-0.12);
      detail.rotation.z=-0.12; bag.add(detail);
    }
    tiltPackDetail(roundedBox(bagRadius*0.23,bagRadius*0.62,bagRadius*0.09,bagRadius*0.04,
      cream,bagRadius*0.68,bagRadius*0.38,-front*bagRadius*0.94,bagRadius*0.025));
    tiltPackDetail(roundedBox(bagRadius*0.29,bagRadius*0.12,bagRadius*0.035,bagRadius*0.02,
      navy,bagRadius*0.68,bagRadius*0.40,-front*bagRadius*1.005,bagRadius*0.012));
    bagCord([[-0.92,0.35,-0.899],[0.0,0.292,-0.915],[0.96,0.35,-0.899]],0.009,navy).rotation.z=-0.12;
`;
html=html.slice(0,start)+replacement+html.slice(end);
assert.ok(html.includes("kiez-reference-v83"));html=html.replace('kiez-reference-v83','kiez-reference-v84');
fs.writeFileSync(file,html);
