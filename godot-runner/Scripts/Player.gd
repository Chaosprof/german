### Player.gd — Artikel Runner endless-runner controller.
### Snappy lane tweens, buffered jumps, slide-roll, stumble + i-frames,
### speed ramp, smooth chase camera with FOV/shake juice.

extends CharacterBody3D

# ── Tuning ───────────────────────────────────────────────────────────
const START_SPEED := 7.0
const MAX_SPEED := 13.5
const SPEED_RAMP := 0.030          # m/s gained per second
const LANE_TWEEN_TIME := 0.16
const JUMP_VELOCITY := 9.6
const GRAVITY := 26.0
const FAST_FALL_MULT := 3.1
const COYOTE_TIME := 0.10
const JUMP_BUFFER := 0.12
const SLIDE_TIME := 0.65
const STUMBLE_TIME := 1.1
const IFRAMES := 1.5
const CAM_FOV_BASE := 71.0
const CAM_FOV_SPAN := 9.0

# ── State ────────────────────────────────────────────────────────────
var run_speed := START_SPEED
var current_lane := 1
var lane_x := 0.0                   # tweened toward LANE_X[current_lane]
var is_sliding := false
var _slide_left := 0.0
var _coyote := 0.0
var _jump_buffer := 0.0
var _was_on_floor := true
var _stumble_left := 0.0
var _iframes := 0.0
var _blink_t := 0.0
var _lane_tween: Tween
var _lean := 0.0                    # mesh lean target (z-rot)
var _dead := false

# Touch / swipe
var _touch_start := Vector2.ZERO
var _touch_id := -1
const SWIPE_MIN := 46.0

# ── Nodes ────────────────────────────────────────────────────────────
@onready var collision_shape: CollisionShape3D = $CollisionShape3D
@onready var mesh_root: Node3D = $"Root Scene"
@onready var anim: AnimationPlayer = $"Root Scene/AnimationPlayer"
@onready var skeleton: Skeleton3D = get_node_or_null("Root Scene/RootNode/Skeleton3D")

var camera: Camera3D
var _cam_shake_amp := 0.0
var _cam_shake_t := 0.0
var _cam_shake_dur := 0.001
var _fov_punch := 0.0

var _capsule_h := 1.8
var _capsule_pos := Vector3.ZERO
var _mesh_rot := Vector3.ZERO
var _mesh_pos := Vector3.ZERO

# FX
var dust: GPUParticles3D
var sparks: GPUParticles3D

# SFX
var _sfx: Dictionary = {}

# Outfits
var _outfit_nodes: Array = []

func _ready() -> void:
	add_to_group("Player")
	if collision_shape.shape is CapsuleShape3D:
		var cap: CapsuleShape3D = collision_shape.shape.duplicate()
		collision_shape.shape = cap
		_capsule_h = cap.height
		_capsule_pos = collision_shape.position
	_mesh_rot = mesh_root.rotation
	_mesh_pos = mesh_root.position
	_setup_camera()
	_setup_particles()
	_setup_sfx()
	_start_run_anim()
	_apply_outfit(Global.current_outfit)
	Global.outfit_changed.connect(func(): _apply_outfit(Global.current_outfit))
	Global.game_ended.connect(_on_game_ended)
	lane_x = CityKit.LANE_X[current_lane]

func reset_run() -> void:
	_dead = false
	run_speed = START_SPEED
	current_lane = 1
	lane_x = CityKit.LANE_X[1]
	global_position = Vector3(lane_x, 0.1, 0)
	velocity = Vector3.ZERO
	_stumble_left = 0.0
	_iframes = 0.0
	_end_slide()
	mesh_root.visible = true
	_start_run_anim()
	_snap_camera()

func _start_run_anim() -> void:
	if anim == null:
		return
	for a in ["Idle", "Running"]:
		if anim.has_animation(a):
			anim.get_animation(a).loop_mode = Animation.LOOP_LINEAR
	anim.play("Running")

# ══════════════════════════════════════════════════════════════════════
#  INPUT
# ══════════════════════════════════════════════════════════════════════
func _unhandled_input(event: InputEvent) -> void:
	# Swipe controls for touch screens
	if event is InputEventScreenTouch:
		if event.pressed and _touch_id == -1:
			_touch_id = event.index
			_touch_start = event.position
		elif not event.pressed and event.index == _touch_id:
			_touch_id = -1
	elif event is InputEventScreenDrag and event.index == _touch_id:
		var d: Vector2 = event.position - _touch_start
		if d.length() >= SWIPE_MIN:
			if absf(d.x) > absf(d.y):
				# Swipe right (+x screen) → move toward -X lane (see _collect_keyboard_input)
				_change_lane(-1 if d.x > 0 else 1)
			elif d.y < 0:
				_queue_jump()
			else:
				_do_slide_input()
			_touch_start = event.position   # allow chained swipes

func _collect_keyboard_input() -> void:
	# The chase camera looks toward +Z, so world +X is on screen-LEFT and -X on
	# screen-RIGHT. Lane index grows with +X, hence "left" steps the index up.
	if Input.is_action_just_pressed("ui_left"):
		_change_lane(1)
	if Input.is_action_just_pressed("ui_right"):
		_change_lane(-1)
	if Input.is_action_just_pressed("ui_jump"):
		_queue_jump()
	if Input.is_action_just_pressed("ui_slide"):
		_do_slide_input()

func _change_lane(dir: int) -> void:
	if _dead:
		return
	var target: int = clampi(current_lane + dir, 0, 2)
	if target == current_lane:
		return
	current_lane = target
	_play_sfx("whoosh", -8.0)
	_lean = -dir * 0.24
	if _lane_tween and _lane_tween.is_valid():
		_lane_tween.kill()
	_lane_tween = create_tween()
	_lane_tween.tween_property(self, "lane_x", CityKit.LANE_X[target], LANE_TWEEN_TIME) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	_lane_tween.tween_callback(func(): _lean = 0.0)

func _queue_jump() -> void:
	if _dead:
		return
	_jump_buffer = JUMP_BUFFER

func _do_slide_input() -> void:
	if _dead:
		return
	if is_on_floor():
		_start_slide()
	else:
		velocity.y = minf(velocity.y, -GRAVITY * 0.55)   # fast fall

# ══════════════════════════════════════════════════════════════════════
#  PHYSICS
# ══════════════════════════════════════════════════════════════════════
func _physics_process(delta: float) -> void:
	if _dead:
		_update_camera(delta)
		return
	_collect_keyboard_input()

	# Speed ramp + stumble recovery
	run_speed = minf(run_speed + SPEED_RAMP * delta, MAX_SPEED)
	var speed := run_speed
	if _stumble_left > 0.0:
		_stumble_left -= delta
		speed *= lerpf(1.0, 0.5, clampf(_stumble_left / STUMBLE_TIME, 0, 1))
	if is_sliding:
		speed *= 1.12

	# Lateral: tweened lane_x drives x velocity for proper collision sweep
	velocity.x = (lane_x - global_position.x) / maxf(delta, 0.0001)
	velocity.x = clampf(velocity.x, -30, 30)

	# Vertical
	if is_on_floor():
		_coyote = COYOTE_TIME
		if not _was_on_floor:
			_on_landed()
	else:
		_coyote -= delta
		var g := GRAVITY
		if velocity.y < 0:
			g *= 1.35      # heavier fall = snappier arc
		velocity.y -= g * delta

	_jump_buffer -= delta
	if _jump_buffer > 0.0 and _coyote > 0.0:
		_do_jump()

	velocity.z = speed
	move_and_slide()
	_was_on_floor = is_on_floor()

	Global.add_distance(speed * delta)

	_update_slide(delta)
	_update_iframes(delta)
	_update_mesh(delta)
	_update_camera(delta)

func _do_jump() -> void:
	_jump_buffer = 0.0
	_coyote = 0.0
	velocity.y = JUMP_VELOCITY
	_end_slide()
	_play_sfx("jump", -6.0)
	if anim and anim.has_animation("Jump"):
		anim.play("Jump", 0.1, 1.25)
	_fov_punch = 4.0

func _on_landed() -> void:
	_shake(0.10, 0.05)
	_play_sfx("land", -14.0)
	dust.restart()
	dust.emitting = true
	if anim and not is_sliding:
		anim.play("Running", 0.18)

func _start_slide() -> void:
	is_sliding = true
	_slide_left = SLIDE_TIME
	_play_sfx("whoosh", -10.0, 0.8)
	if collision_shape.shape is CapsuleShape3D:
		var cap: CapsuleShape3D = collision_shape.shape
		cap.height = 0.7
		collision_shape.position = _capsule_pos + Vector3(0, -(_capsule_h - 0.7) * 0.5, 0)
	# Forward roll
	var tw := create_tween()
	tw.tween_property(mesh_root, "rotation:x", _mesh_rot.x + TAU * 0.96, 0.45) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(mesh_root, "position:y", _mesh_pos.y + 0.25, 0.2)
	tw.tween_property(mesh_root, "rotation:x", _mesh_rot.x, 0.001)
	tw.tween_property(mesh_root, "position:y", _mesh_pos.y, 0.1)

func _end_slide() -> void:
	if not is_sliding:
		return
	is_sliding = false
	if collision_shape.shape is CapsuleShape3D:
		var cap: CapsuleShape3D = collision_shape.shape
		cap.height = _capsule_h
		collision_shape.position = _capsule_pos
	if anim and is_on_floor():
		anim.play("Running", 0.15)

func _update_slide(delta: float) -> void:
	if is_sliding:
		_slide_left -= delta
		if _slide_left <= 0.0:
			_end_slide()

func _update_iframes(delta: float) -> void:
	if _iframes > 0.0:
		_iframes -= delta
		_blink_t += delta
		mesh_root.visible = fmod(_blink_t, 0.16) < 0.09
		if _iframes <= 0.0:
			mesh_root.visible = true

func _update_mesh(delta: float) -> void:
	# Lean into lane changes
	mesh_root.rotation.z = lerpf(mesh_root.rotation.z, _lean, minf(delta * 11.0, 1.0))
	# Safety net: the non-looping "Jump" clip holds its last frame (a raised leg).
	# If a landing event is ever missed, force the run cycle back while grounded so
	# the character can never get stuck mid-stride.
	if anim and is_on_floor() and not is_sliding \
			and anim.current_animation != "Running":
		anim.play("Running", 0.15)
	# Run animation speed follows ground speed
	if anim and anim.current_animation == "Running":
		anim.speed_scale = run_speed / START_SPEED * 1.05

# ══════════════════════════════════════════════════════════════════════
#  HITS / PICKUPS
# ══════════════════════════════════════════════════════════════════════
func hit_obstacle(ob: Node3D) -> void:
	if _dead or _iframes > 0.0:
		return
	_iframes = IFRAMES
	_blink_t = 0.0
	_stumble_left = STUMBLE_TIME
	_end_slide()
	_play_sfx("crash", -2.0)
	_shake(0.4, 0.22)
	_fov_punch = -7.0
	sparks.global_position = global_position + Vector3(0, 0.8, 0.3)
	sparks.restart()
	sparks.emitting = true
	Global.register_crash()

func on_coin_collected(at: Vector3) -> void:
	_play_sfx("coin", -8.0, randf_range(0.96, 1.06))

func on_gate_answered(correct: bool) -> void:
	if correct:
		_play_sfx("correct", -3.0)
		_fov_punch = 5.0
	else:
		_play_sfx("wrong", -3.0)
		_shake(0.35, 0.16)
		_iframes = maxf(_iframes, 0.8)   # grace period after a wrong gate
		_blink_t = 0.0

func _on_game_ended(_won: bool) -> void:
	_dead = true
	velocity = Vector3.ZERO
	if anim and anim.has_animation("Idle"):
		anim.play("Idle", 0.3)

# ══════════════════════════════════════════════════════════════════════
#  CAMERA
# ══════════════════════════════════════════════════════════════════════
func _setup_camera() -> void:
	camera = Camera3D.new()
	camera.top_level = true
	camera.fov = CAM_FOV_BASE
	camera.near = 0.1
	camera.far = 420.0
	add_child(camera)
	camera.current = true
	_snap_camera()

func _snap_camera() -> void:
	var p := global_position
	camera.global_position = Vector3(p.x * 0.5, 2.8, p.z - 4.9)
	camera.look_at(Vector3(p.x * 0.55, 1.55, p.z + 9.0))

func _update_camera(delta: float) -> void:
	if camera == null:
		return
	var p := global_position
	var tx: float = p.x * 0.5
	var ty: float = 2.8 + maxf(p.y - 1.2, 0.0) * 0.25
	var tz: float = p.z - 4.9
	var cp := camera.global_position
	cp.x = lerpf(cp.x, tx, minf(delta * 7.5, 1.0))
	cp.y = lerpf(cp.y, ty, minf(delta * 6.0, 1.0))
	cp.z = tz
	# Shake
	if _cam_shake_t > 0.0:
		_cam_shake_t -= delta
		var k := _cam_shake_amp * clampf(_cam_shake_t / _cam_shake_dur, 0, 1)
		cp.x += randf_range(-k, k)
		cp.y += randf_range(-k, k)
	camera.global_position = cp
	camera.look_at(Vector3(p.x * 0.55, 1.55, p.z + 9.0))
	# Subtle roll with lateral motion
	camera.rotation.z = clampf(-velocity.x * 0.006, -0.05, 0.05)
	# FOV: speed + punches
	_fov_punch = lerpf(_fov_punch, 0.0, minf(delta * 5.0, 1.0))
	var speed_t: float = (run_speed - START_SPEED) / (MAX_SPEED - START_SPEED)
	camera.fov = CAM_FOV_BASE + speed_t * CAM_FOV_SPAN + _fov_punch

func _shake(dur: float, amp: float) -> void:
	_cam_shake_t = maxf(_cam_shake_t, dur)
	_cam_shake_dur = maxf(dur, 0.001)
	_cam_shake_amp = maxf(_cam_shake_amp, amp)

# ══════════════════════════════════════════════════════════════════════
#  PARTICLES & SFX
# ══════════════════════════════════════════════════════════════════════
func _setup_particles() -> void:
	dust = _make_particles(Color(0.93, 0.88, 0.78, 0.65), 14, 0.4, true)
	dust.position = Vector3(0, -0.85, 0)
	add_child(dust)
	sparks = _make_particles(Color(1.0, 0.45, 0.15, 0.9), 24, 0.45, true)
	sparks.top_level = true
	add_child(sparks)

func _make_particles(color: Color, amount: int, life: float, burst: bool) -> GPUParticles3D:
	var p := GPUParticles3D.new()
	var m := ParticleProcessMaterial.new()
	m.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	m.emission_sphere_radius = 0.18
	m.direction = Vector3(0, 1, -0.6) if burst else Vector3(0, 0.25, -1)
	m.spread = 70.0 if burst else 16.0
	m.initial_velocity_min = 1.8 if burst else 0.6
	m.initial_velocity_max = 3.8 if burst else 1.4
	m.gravity = Vector3(0, -6 if burst else -1.2, 0)
	m.scale_min = 0.25
	m.scale_max = 0.5
	var curve := Curve.new()
	curve.add_point(Vector2(0, 1))
	curve.add_point(Vector2(1, 0))
	var ct := CurveTexture.new()
	ct.curve = curve
	m.scale_curve = ct
	p.process_material = m
	var quad := QuadMesh.new()
	quad.size = Vector2(0.2, 0.2)
	var qm := StandardMaterial3D.new()
	qm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	qm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	qm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	qm.albedo_color = color
	qm.albedo_texture = CityKit.soft_dot()
	qm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	quad.material = qm
	p.draw_pass_1 = quad
	p.amount = amount
	p.lifetime = life
	p.one_shot = burst
	p.explosiveness = 1.0 if burst else 0.0
	p.emitting = false
	return p

func _setup_sfx() -> void:
	var sources := {
		"jump": "res://Assets/SFX/jump.wav",
		"land": "res://Assets/SFX/land.wav",
		"coin": "res://Assets/SFX/coin.wav",
		"correct": "res://Assets/SFX/correct.wav",
		"wrong": "res://Assets/SFX/wrong.wav",
		"whoosh": "res://Assets/SFX/whoosh.wav",
		"crash": "res://Assets/SFX/crash.wav",
	}
	for key in sources:
		if ResourceLoader.exists(sources[key]):
			var pl := AudioStreamPlayer.new()
			pl.stream = load(sources[key])
			add_child(pl)
			_sfx[key] = pl

func _play_sfx(key: String, vol_db := 0.0, pitch := 1.0) -> void:
	if _sfx.has(key):
		var pl: AudioStreamPlayer = _sfx[key]
		pl.volume_db = vol_db
		pl.pitch_scale = pitch
		pl.play()

# ══════════════════════════════════════════════════════════════════════
#  OUTFITS (mastery rewards — procedural hats & backpack)
# ══════════════════════════════════════════════════════════════════════
func _apply_outfit(outfit_name: String) -> void:
	for n in _outfit_nodes:
		if is_instance_valid(n):
			n.queue_free()
	_outfit_nodes.clear()
	if not skeleton:
		return
	_attach_backpack()
	match outfit_name:
		"berlin": _attach_beanie()
		"bayern": _attach_bavarian_hat()
		"hamburg": _attach_rain_hat()

func _attach_to_bone(bone_name: String, mesh: Mesh, mat: Material, offset := Vector3.ZERO, scale_v := Vector3.ONE) -> void:
	var bone_idx := skeleton.find_bone(bone_name)
	if bone_idx < 0:
		return
	var att := BoneAttachment3D.new()
	att.bone_name = bone_name
	att.bone_idx = bone_idx
	skeleton.add_child(att)
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = offset
	mi.scale = scale_v
	att.add_child(mi)
	_outfit_nodes.append(att)

func _mat(color: Color, metallic_v := 0.0, roughness_v := 0.8) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.metallic = metallic_v
	m.roughness = roughness_v
	return m

func _attach_backpack() -> void:
	var box := BoxMesh.new()
	box.size = Vector3(0.25, 0.28, 0.15)
	_attach_to_bone("mixamorig_Spine2", box, _mat(Color(0.22, 0.35, 0.18)), Vector3(0, 0.05, -0.15))

func _attach_beanie() -> void:
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.0
	cyl.bottom_radius = 0.11
	cyl.height = 0.14
	cyl.radial_segments = 8
	_attach_to_bone("mixamorig_Head", cyl, _mat(Color(0.15, 0.15, 0.15)), Vector3(0, 0.14, 0))

func _attach_bavarian_hat() -> void:
	var brim := CylinderMesh.new()
	brim.top_radius = 0.18
	brim.bottom_radius = 0.18
	brim.height = 0.03
	brim.radial_segments = 12
	_attach_to_bone("mixamorig_Head", brim, _mat(Color(0.20, 0.40, 0.72)), Vector3(0, 0.12, 0))
	var crown := CylinderMesh.new()
	crown.top_radius = 0.08
	crown.bottom_radius = 0.12
	crown.height = 0.12
	crown.radial_segments = 10
	_attach_to_bone("mixamorig_Head", crown, _mat(Color(0.92, 0.92, 0.95)), Vector3(0, 0.18, 0))

func _attach_rain_hat() -> void:
	var brim := CylinderMesh.new()
	brim.top_radius = 0.20
	brim.bottom_radius = 0.16
	brim.height = 0.03
	brim.radial_segments = 12
	_attach_to_bone("mixamorig_Head", brim, _mat(Color(0.12, 0.15, 0.28)), Vector3(0, 0.12, 0))
	var dome := SphereMesh.new()
	dome.radius = 0.12
	dome.height = 0.14
	_attach_to_bone("mixamorig_Head", dome, _mat(Color(0.12, 0.15, 0.28)), Vector3(0, 0.18, 0))
