"""Authored additive action library for the Berlin Runner v10 rig.

Blender owns the primary poses; the game only phase-scrubs and weights them.
Every clip begins and ends at the neutral additive reference and contains no
root/object translation, so gameplay physics remains authoritative.
"""
import math
import bpy


def _clamp01(v):
    return max(0.0, min(1.0, v))


def _ease(v):
    v = _clamp01(v)
    return v * v * (3.0 - 2.0 * v)


def _window(t, a, b, c, d):
    return _ease((t - a) / max(.001, b - a)) * (1 - _ease((t - c) / max(.001, d - c)))


def _catmull(p0, p1, p2, p3, t):
    t2, t3 = t*t, t*t*t
    v = .5 * ((2*p1) + (-p0+p2)*t + (2*p0-5*p1+4*p2-p3)*t2 +
              (-p0+3*p1-3*p2+p3)*t3)
    return max(min(p1, p2), min(max(p1, p2), v))


def _sample(times, values, t):
    k = 0
    while k < len(times)-2 and times[k+1] < t:
        k += 1
    span = times[k+1] - times[k]
    u = (t-times[k])/span if span > 1e-6 else 0
    out = []
    for c in range(3):
        out.append(_catmull(values[max(0,k-1)][c], values[k][c],
                            values[k+1][c], values[min(len(values)-1,k+2)][c], u))
    return tuple(out)


def _p(flat):
    return [tuple(flat[i:i+3]) for i in range(0, len(flat), 3)]


def set_action_linear(action):
    """Blender 5.2 layered-Action API; keeps glTF tracks LINEAR, not cubic."""
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:
                        key.interpolation = 'LINEAR'


def _bake(arm, name, duration, times=None, poses=None, pose_at=None,
          locations=None, location_at=None, fps=120):
    arm.animation_data_create()
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    arm.animation_data.action = action
    try:
        arm.animation_data.action_slot = action.slots[0] if action.slots else None
    except Exception:
        pass
    steps = max(1, math.ceil(duration * fps))
    for sample in range(steps+1):
        t = duration * sample / steps
        frame = t * fps
        bpy.context.scene.frame_set(int(frame), subframe=frame-int(frame))
        for bone in arm.pose.bones:
            bone.matrix_basis.identity()
        frame_pose = pose_at(t) if pose_at else {
            bone: _sample(times, values, t) for bone, values in poses.items()
        }
        frame_locations = location_at(t) if location_at else ({
            bone: _sample(times, values, t) for bone, values in locations.items()
        } if locations else {})
        for bone_name, xyz in frame_pose.items():
            bone = arm.pose.bones[bone_name]
            bone.rotation_mode = 'XYZ'
            bone.rotation_euler = xyz
            bone.keyframe_insert('rotation_euler', frame=frame)
        for bone_name, xyz in frame_locations.items():
            bone = arm.pose.bones[bone_name]
            bone.location = xyz
            bone.keyframe_insert('location', frame=frame)
    set_action_linear(action)
    bpy.context.scene.frame_set(0)
    return action


def _jump():
    return [0,.07,.16,.34,.56,.76], {
      # The apex is authored for the rear chase camera, not a side-on rig
      # sheet: one knee breaks the torso contour, the opposite leg trails with
      # its sole presented, and both elbows form separate silhouette islands.
      'Hips':_p([0,0,0,-.34,0,0,.14,0,0,-.38,0,-.08,.16,0,-.03,0,0,0]),
      'Spine':_p([0,0,0,.16,0,0,-.12,0,0,.26,0,.10,-.04,0,.04,0,0,0]),
      'Spine01':_p([0,0,0,.10,0,0,-.08,0,0,.30,0,.08,-.02,0,.03,0,0,0]),
      'Spine02':_p([0,0,0,.05,0,0,-.06,0,0,.22,0,.05,-.01,0,.02,0,0,0]),
      'Head':_p([0,0,0,-.06,0,0,-.10,0,0,-.18,0,-.06,-.12,0,-.03,0,0,0]),
      'LeftUpLeg':_p([0,0,0,-.22,0,-.05,.16,0,-.06,-1.82,-.10,-.42,-.50,-.04,-.16,0,0,0]),
      'RightUpLeg':_p([0,0,0,-.18,0,.05,.14,0,.06,-.48,.08,.30,-.12,.03,.12,0,0,0]),
      'LeftLeg':_p([0,0,0,.48,0,0,.10,0,0,2.20,0,0,.32,0,0,0,0,0]),
      'RightLeg':_p([0,0,0,.42,0,0,.08,0,0,.92,0,0,.10,0,0,0,0,0]),
      'LeftFoot':_p([0,0,0,.12,0,-.03,-.34,0,-.04,-.38,.10,-.10,.38,.04,-.03,0,0,0]),
      'RightFoot':_p([0,0,0,.10,0,.03,-.28,0,.04,.55,-.08,.08,.48,-.03,.03,0,0,0]),
      'LeftArm':_p([0,0,0,.20,0,-.08,.58,0,-.10,-.52,.05,-.72,-.42,.02,-.25,0,0,0]),
      'RightArm':_p([0,0,0,.18,0,.08,.50,0,.10,-.32,-.05,.68,-.36,-.02,.25,0,0,0]),
      'LeftForeArm':_p([0,0,0,-.10,0,0,-.06,0,0,1.35,0,-.12,.65,0,-.05,0,0,0]),
      'RightForeArm':_p([0,0,0,-.08,0,0,-.04,0,0,1.05,0,.12,.50,0,.05,0,0,0]),
      'LeftHand':_p([0,0,0,.04,-.02,-.04,.07,-.03,-.08,-.12,.08,.20,.06,-.03,-.08,0,0,0]),
      'RightHand':_p([0,0,0,.05,.02,.04,.08,.03,.08,-.10,-.08,-.18,.06,.03,.08,0,0,0])}


def _mirror_pose(poses):
    """Mirror local XYZ offsets across the character centre line."""
    mirrored = {}
    for name, values in poses.items():
        if name.startswith('Left'):
            target = 'Right' + name[4:]
        elif name.startswith('Right'):
            target = 'Left' + name[5:]
        else:
            target = name
        mirrored[target] = [(x, -y, -z) for x, y, z in values]
    return mirrored


def _jump_takeoff_variants():
    times, right = _jump()
    # The right-support version loads and extends one visible planted leg
    # before both feet leave the road. Its sagittal mirror handles the other
    # half of the gait without changing timing or forward/vertical COM.
    right['RightUpLeg'][1]=(-.30,0,.05); right['RightLeg'][1]=(.58,0,0)
    right['RightFoot'][1]=(.16,0,.03)
    right['LeftUpLeg'][1]=(-.14,0,-.05); right['LeftLeg'][1]=(.34,0,0)
    right['LeftFoot'][1]=(.08,0,-.03)
    right['RightUpLeg'][2]=(.18,0,.06); right['RightLeg'][2]=(.04,0,0)
    right['RightFoot'][2]=(-.34,0,.04)
    right['LeftUpLeg'][2]=(-.42,0,-.08); right['LeftLeg'][2]=(.72,0,0)
    right['LeftFoot'][2]=(.08,0,-.04)
    right['LeftArm'][2]=(.55,0,-.10); right['RightArm'][2]=(-.34,0,.10)
    left = _mirror_pose(right)
    # Takeoff is support-foot specific; once airborne, both clips converge to
    # the same deliberately asymmetric chase-camera apex/descent performance.
    # That gives the player a consistent jump silhouette while still preserving
    # the correct plant and knee drive during the first 160 ms.
    for name in right:
        left[name][3] = right[name][3]
        left[name][4] = right[name][4]
    return (times, left), (times, right)


def _land():
    return [0,.05,.14,.22,.30], {
      'Hips':_p([0,0,0,-.54,0,0,-.36,0,0,.34,0,0,0,0,0]),
      'Spine':_p([0,0,0,.40,0,0,.28,0,0,-.18,0,0,0,0,0]),
      'Spine01':_p([0,0,0,.26,0,0,.19,0,0,-.20,0,0,0,0,0]),
      'Spine02':_p([0,0,0,.12,0,0,.08,0,0,-.07,0,0,0,0,0]),
      'Head':_p([0,0,0,-.20,0,0,-.12,0,0,.12,0,0,0,0,0]),
      'LeftUpLeg':_p([0,0,0,-.78,0,-.09,-.58,0,-.07,-.10,0,-.02,0,0,0]),
      'RightUpLeg':_p([0,0,0,-.74,0,.09,-.54,0,.07,-.08,0,.02,0,0,0]),
      'LeftLeg':_p([0,0,0,1.22,0,0,.92,0,0,.16,0,0,0,0,0]),
      'RightLeg':_p([0,0,0,1.16,0,0,.88,0,0,.14,0,0,0,0,0]),
      'LeftFoot':_p([0,0,0,.22,0,-.05,.16,0,-.03,-.08,0,0,0,0,0]),
      'RightFoot':_p([0,0,0,.20,0,.05,.14,0,.03,-.06,0,0,0,0,0]),
      'LeftArm':_p([0,0,0,-.58,0,-.38,-.40,0,-.28,.20,0,-.14,0,0,0]),
      'RightArm':_p([0,0,0,-.54,0,.38,-.36,0,.28,.18,0,.14,0,0,0])}


def _roll():
    return [0,.07,.18,.42,.62], {
      'Hips':_p([0,0,0,-.10,0,0,.12,0,-.10,.11,0,-.08,0,0,0]),
      'Spine':_p([0,0,0,.07,0,0,.15,0,-.10,.14,0,-.08,0,0,0]),
      'Spine01':_p([0,0,0,.05,0,0,.11,0,-.06,.10,0,-.05,0,0,0]),
      'Spine02':_p([0,0,0,.03,0,0,.07,0,0,.06,0,0,0,0,0]),
      'Head':_p([0,0,0,.04,0,0,.10,0,.08,.08,0,.06,0,0,0]),
      'LeftUpLeg':_p([0,0,0,-.46,0,-.06,-1.28,0,-.14,-1.24,0,-.13,0,0,0]),
      'RightUpLeg':_p([0,0,0,-.20,0,.06,-1.08,0,.16,-1.05,0,.15,0,0,0]),
      'LeftLeg':_p([0,0,0,.18,0,0,1.68,0,0,1.64,0,0,0,0,0]),
      'RightLeg':_p([0,0,0,.70,0,0,1.90,0,0,1.85,0,0,0,0,0]),
      'LeftFoot':_p([0,0,0,-.20,0,0,-.56,0,-.06,-.54,0,-.06,0,0,0]),
      'RightFoot':_p([0,0,0,.12,0,0,.38,0,.08,.35,0,.08,0,0,0]),
      'LeftArm':_p([0,0,0,.16,0,-.06,-.45,0,-.08,-.42,0,-.06,0,0,0]),
      'RightArm':_p([0,0,0,.14,0,.08,.25,0,.06,.22,0,.05,0,0,0]),
      'LeftForeArm':_p([0,0,0,-.10,0,0,.90,0,0,.86,0,0,0,0,0]),
      'RightForeArm':_p([0,0,0,-.08,0,0,1.65,0,0,1.55,0,0,0,0,0]),
      'LeftHand':_p([0,0,0,.05,0,-.06,.06,0,-.05,.05,0,-.04,0,0,0]),
      'RightHand':_p([0,0,0,.06,0,.10,.10,0,.16,.09,0,.14,0,0,0])}


def _stumble():
    return [0,.08,.22,.38,.58,.84], {
      'Hips':_p([0,0,0,-.52,.10,-.16,-.18,-.08,.20,-.34,-.12,.18,.18,.08,-.10,0,0,0]),
      'Spine':_p([0,0,0,.68,0,.18,.22,0,-.20,.36,0,-.18,-.20,0,.14,0,0,0]),
      'Spine01':_p([0,0,0,.34,0,.10,-.18,0,-.26,.38,0,-.24,-.12,0,.10,0,0,0]),
      'Head':_p([0,0,0,-.42,0,-.12,.20,.08,.18,-.16,-.06,-.10,.16,-.06,-.08,0,0,0]),
      'LeftUpLeg':_p([0,0,0,-.18,0,-.08,-.44,0,-.15,-.62,0,-.08,-.18,0,-.03,0,0,0]),
      'RightUpLeg':_p([0,0,0,.12,0,.08,.34,0,.14,-.22,0,.08,.10,0,.03,0,0,0]),
      'LeftLeg':_p([0,0,0,.26,0,0,.12,0,0,.88,0,0,.22,0,0,0,0,0]),
      'RightLeg':_p([0,0,0,.08,0,0,-.18,0,0,.32,0,0,.12,0,0,0,0,0]),
      'RightFoot':_p([0,0,0,.38,0,.10,.14,0,.06,-.08,0,0,0,0,0,0,0,0]),
      'LeftArm':_p([0,0,0,-.30,0,-.34,-1.02,0,-.82,-.36,0,-.28,.18,0,.12,0,0,0]),
      'RightArm':_p([0,0,0,.18,0,.30,.42,0,.76,-.48,0,.42,-.16,0,-.10,0,0,0]),
      'LeftForeArm':_p([0,0,0,-.34,0,0,-.86,0,0,-.42,0,0,-.16,0,0,0,0,0]),
      'RightForeArm':_p([0,0,0,-.28,0,0,-.70,0,0,-.36,0,0,-.14,0,0,0,0,0]),
      'LeftHand':_p([0,0,0,-.08,.03,-.10,-.20,.08,-.24,-.12,.04,-.16,-.04,0,-.05,0,0,0]),
      'RightHand':_p([0,0,0,.07,-.03,.10,.18,-.08,.22,.10,-.04,.15,.03,0,.05,0,0,0])}


def _victory(side):
    arm = 'RightArm' if side > 0 else 'LeftArm'
    fore = 'RightForeArm' if side > 0 else 'LeftForeArm'
    hand = 'RightHand' if side > 0 else 'LeftHand'
    return [0,.12,.24,.42,.68], {
      'Hips':_p([0,0,0,.08,side*.06,-side*.06,-.10,-side*.08,side*.10,.06,side*.04,-side*.05,0,0,0]),
      'Spine01':_p([0,0,0,.10,side*.06,-side*.06,-.16,side*.12,-side*.10,.10,-side*.06,side*.06,0,0,0]),
      'Spine02':_p([0,0,0,.12,-side*.05,side*.08,.18,-side*.10,side*.14,-.08,side*.05,-side*.06,0,0,0]),
      'Head':_p([0,0,0,.08,-side*.08,side*.06,-.20,side*.12,-side*.12,.10,-side*.05,side*.06,0,0,0]),
      arm:_p([0,0,0,.42,0,-side*.18,-1.50,0,side*.42,-1.20,0,side*.28,0,0,0]),
      fore:_p([0,0,0,-.34,0,0,-1.08,0,0,-.72,0,0,0,0,0]),
      hand:_p([0,0,0,-.08,side*.04,side*.08,-.22,side*.10,side*.20,-.10,side*.04,side*.10,0,0,0])}


def _cut(direction, support_name=None):
    def pose(t):
        l=_window(t,0,.025,.055,.095); p=_window(t,.045,.085,.145,.205)
        c=_window(t,.125,.175,.235,.295); k=_window(t,.225,.275,.345,.415)
        arm_load=_ease(t/.025)*(1-_ease((t-.095)/.030))
        arm_push=_window(t,.095,.120,.150,.215)
        leg_cross=_ease((t-.040)/.035)*(1-_ease((t-.165)/.040))
        # The default clips push from the foot opposite travel. In the rear
        # camera that choreography is heavily foreshortened, so its push beat
        # needs a stronger shoulder/arm counterline and lateral free-knee read
        # than the same-side support variants.
        push_read = 1.55
        # The outside-support cut projects its free leg almost end-on from the
        # chase camera. Give that variant extra abduction through the held push
        # so knee and shoe stay travel-side like the same-side performance.
        cross_read = 1.30 if direction > 0 else .10
        # The chase camera exposes the rightward free shin almost side-on. Add
        # flex there (and a smaller baseline bend on the mirrored move) so the
        # push reads as a compact crossover rather than a straight side kick.
        if direction > 0:
            lead_knee_cross = .85 if support_name is not None else 1.10
        else:
            lead_knee_cross = 1.10 if support_name is None else 1.20
        # With the opposite support foot, the lead thigh is on the far side of
        # the rear camera and its local roll projects with the opposite screen
        # sign. Flip only those variants so the visible knee/sole land on the
        # requested travel side; same-side variants already read correctly.
        lead_travel_sign = -direction if support_name is None else direction
        support = support_name or ('Right' if direction>0 else 'Left')
        lead = 'Left' if support == 'Right' else 'Right'
        side = -1 if support == 'Right' else 1
        support_right = support == 'Right'
        # At canonical contact the run clip carries a ~+/-1 rad arm swing and
        # one elbow is deeply flexed. Cancel that known inherited pose during
        # load so neither support phase can park a fist beside the head and
        # accidentally turn anticipation into a stumble silhouette.
        left_load_arm_x = .72 if support_right else -.90
        right_load_arm_x = -.90 if support_right else .72
        left_load_fore_x = -1.35 if support_right else -.35
        right_load_fore_x = -.35 if support_right else -1.35
        # Cancel the run contact's inward arm plane as well as its swing. These
        # values produce the same outward +/-0.35 rad shoulder line for either
        # support phase, keeping both straightened hands clear of the jaw.
        left_load_arm_z = 0 if support_right else -.40
        right_load_arm_z = .40 if support_right else 0
        support_hip_x = .16*l-.10*p
        support_knee_x = .34*l+.06*p
        support_roll = side*(.11*l+.10*p)
        hips_x = -.10*l+.06*c
        push_yaw = (-.41 if support_name is not None else -.34) if direction > 0 else -.14
        hips_y = direction*(push_yaw*p+.10*k)
        push_bank = -.20 if direction > 0 else -.16
        hips_roll = direction*(-.13*l+push_bank*p+.12*c-.12*k)
        return {
          'Hips':(hips_x,hips_y,hips_roll),
          'Spine01':(.07*l-.05*k,direction*(.12*p-.10*k),
                     direction*(-.06*l-.12*p+.10*c+.10*k)),
          # Keep lateral intent visible after the initial bank: the shoulders
          # twist into push/crossover and the arms counter-swing as a graphic
          # pair. This must read in a centered hero-only crop, without relying
          # on the road position to reveal the lane direction.
          'Spine02':(.03*l-.03*k,
                     direction*(.10*l+.22*p*push_read-.10*c-.08*k),
                     direction*(-.03*l-.08*p+.06*c+.05*k)),
          'Head':(0,-direction*.04*l,direction*.30*l),
          # A real cut compresses over the planted leg, then extends it. The
          # old pose added more flex during "push", lifting the shoe precisely
          # when it was meant to generate the lane change. Counter-rotate the
          # ankle by the complete sagittal/roll chain so the authored sole stays
          # flat while the knee and pelvis visibly load above it.
          support+'UpLeg':(support_hip_x,0,support_roll),
          support+'Leg':(support_knee_x,0,0),
          support+'Foot':(-(hips_x+support_hip_x+support_knee_x),-hips_y,
                          -(hips_roll+support_roll)),
          lead+'UpLeg':(-.12*leg_cross-.20*c+.08*k,0,
                        lead_travel_sign*(.16*cross_read*leg_cross+.08*k)),
          lead+'Leg':(lead_knee_cross*leg_cross+.28*c+.42*k,0,0),
          lead+'Foot':(-.10*leg_cross-.10*c+.15*k,
                       direction*(.08*leg_cross+.05*c-.05*k),
                       lead_travel_sign*(.07*cross_read*leg_cross+.08*k)),
          'LeftArm':(left_load_arm_x*arm_load+direction*(.34*arm_push*push_read-.16*c),0,
                     left_load_arm_z*arm_load+direction*(-.28*arm_push*push_read+.12*c+.10*k)),
          'RightArm':(right_load_arm_x*arm_load+direction*(-.42*arm_push*push_read+.18*c),0,
                      right_load_arm_z*arm_load+direction*(.30*arm_push*push_read-.14*c+.10*k)),
          'LeftForeArm':(left_load_fore_x*arm_load,0,0),
          'RightForeArm':(right_load_fore_x*arm_load,0,0)}
    return pose


def _cut_location(direction):
    """Pelvis load/drive/catch layered over the physics-owned lane root."""
    def location(t):
        l=_window(t,0,.025,.055,.095); p=_window(t,.045,.085,.145,.205)
        c=_window(t,.125,.175,.235,.295); k=_window(t,.225,.275,.345,.415)
        return {'Hips': (direction*(-.050*l+.120*p+.140*c+.040*k),
                         -.020*p-.012*c, -.050*l-.010*p+.018*c-.055*k)}
    return location


_ACTION_LOCATIONS = {
  'hero_jump': {'Hips':_p([0,0,0, 0,.015,-.055, 0,-.018,.040,
                            0,-.010,.070, 0,.012,-.025, 0,0,0])},
  'hero_land': {'Hips':_p([0,0,0, 0,.025,-.115, 0,.012,-.085,
                            0,-.010,.035, 0,0,0])},
  'hero_roll': {'Hips':_p([0,0,0, 0,-.025,-.065, 0,-.085,.055,
                            0,-.065,.045, 0,0,0])},
  'hero_stumble': {'Hips':_p([0,0,0, -.030,.020,-.045, -.055,-.035,.020,
                               .035,.020,-.070, -.015,-.010,.020, 0,0,0])},
  'hero_victory_l': {'Hips':_p([0,0,0, -.018,0,-.015, .030,-.015,.040,
                                 -.012,0,.018, 0,0,0])},
  'hero_victory_r': {'Hips':_p([0,0,0, .018,0,-.015, -.030,-.015,.040,
                                 .012,0,.018, 0,0,0])},
}

_ACTION_LOCATIONS['hero_jump_l'] = {'Hips':_p([
  0,0,0, -.022,.015,-.055, .015,-.018,.040, 0,-.010,.070,
  0,.012,-.025, 0,0,0])}
_ACTION_LOCATIONS['hero_jump_r'] = {'Hips':_p([
  0,0,0, .022,.015,-.055, -.015,-.018,.040, 0,-.010,.070,
  0,.012,-.025, 0,0,0])}


def bake_gameplay_actions(arm, fps=120):
    actions=[]
    for name,duration,spec in [('hero_jump',.76,_jump()),('hero_land',.30,_land()),
                               ('hero_roll',.62,_roll()),('hero_stumble',.84,_stumble()),
                               ('hero_victory_l',.68,_victory(-1)),
                               ('hero_victory_r',.68,_victory(1))]:
        actions.append(_bake(arm,name,duration,*spec,
                             locations=_ACTION_LOCATIONS[name],fps=fps))
    jump_l, jump_r = _jump_takeoff_variants()
    actions.append(_bake(arm,'hero_jump_l',.76,*jump_l,
                         locations=_ACTION_LOCATIONS['hero_jump_l'],fps=fps))
    actions.append(_bake(arm,'hero_jump_r',.76,*jump_r,
                         locations=_ACTION_LOCATIONS['hero_jump_r'],fps=fps))
    actions.append(_bake(arm,'hero_lane_l',.42,pose_at=_cut(1),
                         location_at=_cut_location(1),fps=fps))
    actions.append(_bake(arm,'hero_lane_r',.42,pose_at=_cut(-1),
                         location_at=_cut_location(-1),fps=fps))
    # The normal directional cuts use the biomechanically natural outside
    # support foot (right foot for travel left, left foot for travel right).
    # Inputs can arrive on any run octant, though, and phase-warping by PI in a
    # few frames is more visible than using a real alternate step. These two
    # clips keep the same travel/COM intent but swap the support and lead-leg
    # choreography, giving the runtime one contact-correct performance for all
    # four direction x planted-foot combinations.
    actions.append(_bake(arm,'hero_lane_l_support_l',.42,
                         pose_at=_cut(1,'Left'),
                         location_at=_cut_location(1),fps=fps))
    actions.append(_bake(arm,'hero_lane_r_support_r',.42,
                         pose_at=_cut(-1,'Right'),
                         location_at=_cut_location(-1),fps=fps))
    return actions
