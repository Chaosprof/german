    var packGeometry = dressCourierHero.packGeometry || (dressCourierHero.packGeometry = {});
    // Satchel colors are independent of the cap. Keep three bag batches.
    var bagTeal = heroTrimMat(0x2d7376, 0.91, 0.055);
    var bagInk = heroTrimMat(0x244e54, 0.94, 0.045);
    var bagLeather = heroTrimMat(0xb68b57, 0.88, 0.07);
    if (BERLIN_COURIER_BAG_DATA.atlas) {
      // Bake the contact between the three canvas layers once in Blender.
      // One cached 256px image adds no shadow pass or per-frame work.
      if (!dressCourierHero.packTexture) {
        var packAtlas = BERLIN_COURIER_BAG_DATA.atlas;
        var packTexture;
        if (typeof document !== 'undefined') {
          var manager = typeof assetManager !== 'undefined' ? assetManager : undefined;
          packTexture = new THREE.TextureLoader(manager).load(
            'data:' + packAtlas.mimeType + ';base64,' + packAtlas.data,
            function () { canvas.dataset.courierBagContact = 'baked-v104'; });
        } else {
          packTexture = new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1,THREE.RGBAFormat);
          packTexture.needsUpdate = true;
        }
        packTexture.name = 'Courier bag soft layer contact';
        packTexture.colorSpace = THREE.SRGBColorSpace;
        packTexture.minFilter = THREE.LinearMipmapLinearFilter;
        packTexture.magFilter = THREE.LinearFilter;
        packTexture.generateMipmaps = true;
        packTexture.anisotropy = 2;
        dressCourierHero.packTexture = packTexture;
      }
      bagTeal.map = dressCourierHero.packTexture;
    }
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
      var shell = new THREE.Mesh(packGeometry[cacheKey], bagTeal);
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
      // The old loops were buried inside the torso. Bring only the short
      // shoulder sections onto the cloth and return the ends into the bag.
      var shoulder = side * 0.94 - 0.35 / 0.74;
      bagCord([[side*0.86,-0.55,0.20],[side*1.02,0.78,-0.05],
        [side*0.94,1.28,-0.34],[shoulder,1.81,-0.29],
        [shoulder,1.86,0.04],[shoulder,1.30,0.80]],0.055,bagInk);
    });
    function tiltPackDetail(detail) {
      detail.position.applyAxisAngle(new THREE.Vector3(0,0,1),-0.12);
      detail.rotation.z=-0.12; bag.add(detail);
    }
    // The rear chase view mirrors bind-space X: negative X is the visible
    // right side. A tan leather tongue crosses the flap hem toward the pocket.
    tiltPackDetail(roundedBox(bagRadius*0.24,bagRadius*0.72,bagRadius*0.09,bagRadius*0.055,
      bagLeather,-bagRadius*0.60,-bagRadius*0.04,-front*bagRadius*0.94,bagRadius*0.025));
    tiltPackDetail(roundedBox(bagRadius*0.17,bagRadius*0.10,bagRadius*0.035,bagRadius*0.02,
      bagInk,-bagRadius*0.60,-bagRadius*0.14,-front*bagRadius*1.005,bagRadius*0.012));
    bagCord([[-1.13,0.395,-0.868],[-0.86,0.321,-0.903],[0.035,0.291,-0.924],
      [0.92,0.321,-0.903],[1.20,0.395,-0.868]],0.016,bagInk).rotation.z=-0.12;
    // A single restrained pocket seam resolves at chase distance; no stitches
    // or texture noise that would flicker as the runner moves.
    bagCord([[-0.79,-0.49,-0.874],[0.025,-0.49,-0.896],[0.84,-0.49,-0.874]],
      0.011,bagInk).rotation.z=-0.12;
