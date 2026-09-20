  // Outer-lane shortcuts share keyboard/touch input and the fixed physics clock.
  // The quiz commits to the requested outer lane during the transfer; obstacles
  // continue to test the real moving body. There is no collision immunity.
  var LANE_WRAP_TIME = 0.48, LANE_FLIP_TIME = 0.42;
  var laneWrapAge = 9, laneWrapCount = 0;
  var laneFlipProgress = 1, interpPrevLaneFlip = 1, visualLaneFlip = 1;
  var laneFlipDir = 1;

  function resetLaneWrap() {
    laneWrapAge = 9; laneWrapCount = 0;
    laneFlipProgress = interpPrevLaneFlip = visualLaneFlip = 1;
    laneFlipDir = 1;
  }

  function beginLaneWrap(previousLane) {
    laneWrapAge = 0; laneWrapCount++;
    laneFootLockActive = false;
    laneActionAge = laneOutgoingAge = 9;
    // A grounded wrap launches a compact aerial. An existing jump or roll
    // keeps its own physics/clip, and rapid taps never restart a half-finished
    // rotation or grant repeated mid-air jumps.
    if (grounded && slideTimer <= 0 && slideExitGrace <= 0 &&
        bufJump <= 0 && bufSlide <= 0 && laneFlipProgress >= 1) {
      jumpWarpFrom = wrapPi(heroRunPhase - visualRunPhase);
      jumpGaitOctant = gaitOctantAt(heroRunPhase);
      jumpSupportSide = gaitSupportAt(heroRunPhase);
      jumpWarpTo = wrapPi((jumpSupportSide > 0 ? 0 : Math.PI) - runPhase);
      player.vy = 10.8;
      grounded = false; coyote = 0; fastFalling = false;
      jumpActionAge = 0; takeoffPulse = 1;
      laneFlipProgress = interpPrevLaneFlip = visualLaneFlip = 0;
      laneFlipDir = Math.sign(LANES[targetLane] - LANES[previousLane]);
      fxTakeoff(player.x, player.z);
    }
    if (gameAudio) {
      var now = gameAudio.currentTime;
      playNoise(now, 0.20, 0.10, 920, 0.7);
      playTone(260, now, 0.20, 0.10, 'triangle', 570);
    }
  }

  function advanceLaneWrap(dt) {
    laneWrapAge = Math.min(9, laneWrapAge + dt);
    if (laneFlipProgress >= 1) return;
    // A down swipe can still fast-fall. Finish the turn before contact instead
    // of locking controls, snapping upright, or rolling through the pavement.
    var flightLeft = (player.vy + Math.sqrt(player.vy * player.vy +
      2 * GRAV * Math.max(0, player.y))) / GRAV;
    var step = Math.max(dt / LANE_FLIP_TIME,
      (1 - laneFlipProgress) * dt / Math.max(dt, flightLeft * 0.88));
    laneFlipProgress = grounded ? 1 : Math.min(1, laneFlipProgress + step);
  }

  function laneForArticle() {
    return laneWrapAge < LANE_WRAP_TIME ? targetLane : laneOf(player.x);
  }

  function applyLaneWrapPose() {
    if (visualLaneFlip >= 1) return;
    var turn = -laneFlipDir * Math.PI * 2 * phaseEase(visualLaneFlip);
    var tuck = Math.sin(Math.PI * visualLaneFlip);
    tuck *= tuck;
    // Side somersault about the pelvis, not the feet. The imported jump clip
    // supplies the knee tuck; this root layer carries the whole dressed rig.
    body.rotation.z = body.rotation.z * (1 - tuck * 0.90) + turn;
    body.rotation.y *= 1 - tuck * 0.85;
    var pivot = 0.94;
    body.position.x += Math.sin(turn) * pivot;
    body.position.y += (1 - Math.cos(turn)) * pivot;
  }
