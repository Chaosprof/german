### Player.gd — Artikel Runner

extends CharacterBody3D

# Animation / run state
var is_jumping = false
var game_starts = false
var game_won = false
var _results_sent = false

# Movement tuning
var speed = 5.0
var jump_velocity = 10.0
const jump_speed = 3.0
const gravity = 20.0

# Lane-based horizontal movement (3 lanes)
const LANE_POSITIONS := [-1.0, 0.0, 1.0]
const LANE_SNAP_SPEED := 16.0
var current_lane: int = 1
var prev_lane: int = 1

# Air-jump polish
const COYOTE_TIME := 0.12
const JUMP_BUFFER := 0.14
const MAX_AIR_JUMPS := 1
var _coyote_left := 0.0
var _jump_buffered := 0.0
var _air_jumps_left := MAX_AIR_JUMPS
var _was_on_floor := true

# Slide
const SLIDE_DURATION := 0.65
const SLIDE_SPEED_BOOST := 1.6
var is_sliding := false
var _slide_timer := 0.0
var _capsule_base_height := 0.0
var _capsule_base_radius := 0.0
var _collider_base_pos := Vector3.ZERO
var _mesh_base_rot := Vector3.ZERO
var _mesh_base_pos := Vector3.ZERO

# Camera juice
const CAM_BASE_FOV := 75.0
const LANE_TILT_DEG := 6.0
const LANE_TILT_SMOOTH := 10.0
var _cam_shake_time := 0.0
var _cam_shake_duration := 0.001
var _cam_shake_amp := 0.0
var _fov_target := CAM_BASE_FOV
var _fov_current := CAM_BASE_FOV
var _fov_hold_timer := 0.0
var _cam_base_local_pos := Vector3.ZERO

# Node refs
@onready var game_timer = $GameTimer
@onready var game_over_screen = $HUD/GameOverScreen
@onready var game_results_label = $HUD/GameOverScreen/Container/Results/Label
@onready var progress_button = $HUD/GameOverScreen/Container/Results/ProgressButton
@onready var world = get_node("/root/Main/World")
@onready var main = get_node("/root/Main/")
@onready var start_screen = $HUD/StartScreen
@onready var level_pass_music = $Sounds/LevelPassMusic
@onready var level_fail_music = $Sounds/LevelFailMusic
@onready var jump_sfx = $Sounds/JumpSFX
@onready var collision_shape: CollisionShape3D = $CollisionShape3D
@onready var mesh_root: Node3D = $"Root Scene"
@onready var camera_pivot: Node3D = $Camera
@onready var camera_3d: Camera3D = $Camera/SpringArm3D/Camera3D

# FX nodes (created programmatically)
var trail_particles: GPUParticles3D
var dust_burst: GPUParticles3D
var impact_burst: GPUParticles3D

# Outfit visuals
var _outfit_nodes: Array[Node] = []
@onready var skeleton: Skeleton3D = get_node_or_null("Root Scene/RootNode/Skeleton3D")

# Game State
enum game_state {CONTINUE, RETRY}
var current_state

func _ready():
	start_screen.visible = false
	game_starts = true
	Global.game_started = true
	game_timer.start()
	Global.score_requirement = 999

	# Cache originals
	if collision_shape and collision_shape.shape is CapsuleShape3D:
		var cap := collision_shape.shape as CapsuleShape3D
		# Duplicate so slide mutations don't leak across instances
		cap = cap.duplicate() as CapsuleShape3D
		collision_shape.shape = cap
		_capsule_base_height = cap.height if cap.height > 0.0 else 2.0
		_capsule_base_radius = cap.radius if cap.radius > 0.0 else 0.5
		_collider_base_pos = collision_shape.position
	if mesh_root:
		_mesh_base_rot = mesh_root.rotation
		_mesh_base_pos = mesh_root.position
	if camera_3d:
		_cam_base_local_pos = camera_3d.position
		camera_3d.fov = CAM_BASE_FOV

	_setup_particles()
	_apply_outfit(Global.current_outfit)
	Global.outfit_changed.connect(_on_outfit_changed)

func _on_outfit_changed():
	_apply_outfit(Global.current_outfit)

func _physics_process(delta):
	handle_movement(delta)
	_update_slide(delta)
	_update_camera(delta)

func handle_movement(delta):
	if not game_starts or game_won:
		return

	# ── Input: lane switching (camera is rotated 180° around Y) ──
	if Input.is_action_just_pressed("ui_right"):
		_change_lane(max(0, current_lane - 1))
	if Input.is_action_just_pressed("ui_left"):
		_change_lane(min(LANE_POSITIONS.size() - 1, current_lane + 1))

	# ── Input: slide ──
	if Input.is_action_just_pressed("ui_slide"):
		if is_on_floor():
			_start_slide()
		else:
			# Fast-fall while airborne, slide queued via quick-drop impulse
			velocity.y = min(velocity.y, -gravity * 0.6)

	# Slide toward target lane
	var target_x: float = LANE_POSITIONS[current_lane]
	velocity.x = (target_x - position.x) * LANE_SNAP_SPEED

	# ── Jump: coyote time, jump buffer, double-jump ──
	if Input.is_action_just_pressed("ui_jump"):
		_jump_buffered = JUMP_BUFFER

	if is_on_floor():
		_coyote_left = COYOTE_TIME
		_air_jumps_left = MAX_AIR_JUMPS
		# Landing event (first frame back on floor)
		if not _was_on_floor:
			_on_landed()
		is_jumping = false
	else:
		_coyote_left -= delta
		velocity.y -= gravity * delta

	_jump_buffered -= delta

	if _jump_buffered > 0.0:
		if _coyote_left > 0.0:
			_do_jump(jump_velocity)
			_jump_buffered = 0.0
			_coyote_left = 0.0
		elif _air_jumps_left > 0:
			_do_jump(jump_velocity * 0.9)
			_air_jumps_left -= 1
			_jump_buffered = 0.0
			_punch_fov(8.0, 0.15)

	# Forward movement: faster while sliding, slight slow while jumping
	var forward: float = speed
	if is_sliding:
		forward *= SLIDE_SPEED_BOOST
	elif is_jumping:
		forward = jump_speed
	velocity.z = forward

	move_and_slide()
	_was_on_floor = is_on_floor()

	# Air platform collision check (only when stalled)
	if velocity.z == 0:
		check_for_platform_collisions()

func _change_lane(new_lane: int) -> void:
	if new_lane == current_lane:
		return
	prev_lane = current_lane
	current_lane = new_lane

func _do_jump(v: float) -> void:
	velocity.y = v
	is_jumping = true
	if jump_sfx:
		jump_sfx.play()
	# Cancel slide if jumping out of it
	if is_sliding:
		_end_slide()

func _on_landed() -> void:
	# Landing juice: dust puff + small shake
	_shake_camera(0.08, 0.08)
	if dust_burst:
		dust_burst.global_position = global_position + Vector3(0, 0.05, 0)
		dust_burst.restart()
		dust_burst.emitting = true

func _start_slide() -> void:
	if is_sliding:
		_slide_timer = SLIDE_DURATION
		return
	is_sliding = true
	_slide_timer = SLIDE_DURATION
	if collision_shape and collision_shape.shape is CapsuleShape3D:
		var cap := collision_shape.shape as CapsuleShape3D
		cap.height = max(0.6, _capsule_base_height * 0.45)
		# Lower the collider so feet stay grounded
		collision_shape.position = _collider_base_pos + Vector3(0, -(_capsule_base_height - cap.height) * 0.5, 0)
	if mesh_root:
		# Lean forward & slightly down
		mesh_root.rotation = _mesh_base_rot + Vector3(deg_to_rad(-70.0), 0, 0)
		mesh_root.position = _mesh_base_pos + Vector3(0, -0.4, 0)

func _end_slide() -> void:
	if not is_sliding:
		return
	is_sliding = false
	_slide_timer = 0.0
	if collision_shape and collision_shape.shape is CapsuleShape3D:
		var cap := collision_shape.shape as CapsuleShape3D
		cap.height = _capsule_base_height
		cap.radius = _capsule_base_radius
		collision_shape.position = _collider_base_pos
	if mesh_root:
		mesh_root.rotation = _mesh_base_rot
		mesh_root.position = _mesh_base_pos

func _update_slide(delta: float) -> void:
	if not is_sliding:
		return
	_slide_timer -= delta
	if _slide_timer <= 0.0:
		_end_slide()

# ── Camera juice ──────────────────────────────────────────────

func _shake_camera(duration: float, amp: float) -> void:
	if duration > _cam_shake_time:
		_cam_shake_time = duration
		_cam_shake_duration = max(duration, 0.001)
	_cam_shake_amp = max(_cam_shake_amp, amp)

func _punch_fov(amount: float, duration: float) -> void:
	_fov_target = CAM_BASE_FOV + amount
	_fov_hold_timer = duration

func _update_camera(delta: float) -> void:
	if not camera_3d or not camera_pivot:
		return

	# FOV punch decay
	if _fov_hold_timer > 0.0:
		_fov_hold_timer -= delta
	else:
		_fov_target = CAM_BASE_FOV
	_fov_current = lerp(_fov_current, _fov_target, clamp(delta * 6.0, 0.0, 1.0))
	camera_3d.fov = _fov_current

	# Lane tilt: roll camera opposite to lateral velocity
	var tilt_target := clampf(-velocity.x * 0.12, -deg_to_rad(LANE_TILT_DEG), deg_to_rad(LANE_TILT_DEG))
	camera_3d.rotation.z = lerp(camera_3d.rotation.z, tilt_target, clampf(delta * LANE_TILT_SMOOTH, 0.0, 1.0))

	# Screen shake — amplitude decays over the shake's own duration
	var shake_offset := Vector3.ZERO
	if _cam_shake_time > 0.0:
		_cam_shake_time -= delta
		var t := clampf(_cam_shake_time / _cam_shake_duration, 0.0, 1.0)
		var amp := _cam_shake_amp * t
		shake_offset = Vector3(randf_range(-amp, amp), randf_range(-amp, amp), 0.0)
		if _cam_shake_time <= 0.0:
			_cam_shake_amp = 0.0
	camera_3d.position = _cam_base_local_pos + shake_offset

# ── Particles ────────────────────────────────────────────────

func _setup_particles() -> void:
	trail_particles = _make_trail_particles()
	trail_particles.position = Vector3(0, -0.6, 0.1)
	add_child(trail_particles)

	dust_burst = _make_dust_burst()
	dust_burst.position = Vector3(0, -0.9, 0)
	add_child(dust_burst)

	impact_burst = _make_impact_burst()
	impact_burst.position = Vector3(0, 0, 0)
	# Parent to /root/Main so burst can detach visually from player on crash
	add_child(impact_burst)

func _make_billboard_quad(size: float, color: Color) -> QuadMesh:
	var quad := QuadMesh.new()
	quad.size = Vector2(size, size)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.albedo_color = color
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	m.vertex_color_use_as_albedo = true
	m.disable_receive_shadows = true
	m.no_depth_test = false
	quad.material = m
	return quad

func _make_trail_particles() -> GPUParticles3D:
	var p := GPUParticles3D.new()
	var mat := ParticleProcessMaterial.new()
	mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	mat.emission_sphere_radius = 0.15
	mat.direction = Vector3(0, 0.3, -1)
	mat.spread = 20.0
	mat.initial_velocity_min = 0.5
	mat.initial_velocity_max = 1.6
	mat.gravity = Vector3(0, -1.5, 0)
	mat.scale_min = 0.25
	mat.scale_max = 0.55
	mat.color = Color(1.0, 0.95, 0.8, 0.55)
	var curve := Curve.new()
	curve.add_point(Vector2(0.0, 1.0))
	curve.add_point(Vector2(1.0, 0.0))
	var scale_tex := CurveTexture.new()
	scale_tex.curve = curve
	mat.scale_curve = scale_tex
	p.process_material = mat
	p.draw_pass_1 = _make_billboard_quad(0.5, Color(1, 0.95, 0.8, 1))
	p.amount = 40
	p.lifetime = 0.7
	p.preprocess = 0.2
	p.emitting = true
	return p

func _make_dust_burst() -> GPUParticles3D:
	var p := GPUParticles3D.new()
	var mat := ParticleProcessMaterial.new()
	mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	mat.emission_sphere_radius = 0.25
	mat.direction = Vector3(0, 1, 0)
	mat.spread = 80.0
	mat.initial_velocity_min = 1.5
	mat.initial_velocity_max = 3.0
	mat.gravity = Vector3(0, -3, 0)
	mat.scale_min = 0.35
	mat.scale_max = 0.8
	mat.color = Color(0.95, 0.9, 0.75, 0.7)
	var curve := Curve.new()
	curve.add_point(Vector2(0.0, 1.0))
	curve.add_point(Vector2(1.0, 0.0))
	var scale_tex := CurveTexture.new()
	scale_tex.curve = curve
	mat.scale_curve = scale_tex
	p.process_material = mat
	p.draw_pass_1 = _make_billboard_quad(0.6, Color(0.95, 0.9, 0.75, 1))
	p.amount = 20
	p.lifetime = 0.5
	p.one_shot = true
	p.explosiveness = 1.0
	p.emitting = false
	return p

func _make_impact_burst() -> GPUParticles3D:
	var p := GPUParticles3D.new()
	var mat := ParticleProcessMaterial.new()
	mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	mat.emission_sphere_radius = 0.2
	mat.direction = Vector3(0, 1, 0)
	mat.spread = 180.0
	mat.initial_velocity_min = 3.0
	mat.initial_velocity_max = 7.0
	mat.gravity = Vector3(0, -6, 0)
	mat.scale_min = 0.3
	mat.scale_max = 0.9
	mat.color = Color(1.0, 0.5, 0.2, 0.9)
	var curve := Curve.new()
	curve.add_point(Vector2(0.0, 1.0))
	curve.add_point(Vector2(1.0, 0.0))
	var scale_tex := CurveTexture.new()
	scale_tex.curve = curve
	mat.scale_curve = scale_tex
	p.process_material = mat
	p.draw_pass_1 = _make_billboard_quad(0.7, Color(1.0, 0.5, 0.2, 1))
	p.amount = 40
	p.lifetime = 0.6
	p.one_shot = true
	p.explosiveness = 1.0
	p.emitting = false
	return p

# External hook — called from Obstacles.gd on crash
func play_impact_fx() -> void:
	_shake_camera(0.35, 0.25)
	_punch_fov(-6.0, 0.12)
	if impact_burst:
		impact_burst.global_position = global_position + Vector3(0, 0.4, 0.2)
		impact_burst.restart()
		impact_burst.emitting = true

# ── Air Platform Collisions ──────────────────────────────────
func check_for_platform_collisions():
	for i in range(get_slide_collision_count()):
		var collision = get_slide_collision(i)
		var collider = collision.get_collider()
		if collider and collider.is_in_group("Air_Platform"):
			if collision.get_normal().dot(Vector3(0, 0, -1)) > 0.5:
				if Global.lives > 0:
					Global.lives -= 1
					Global.lives_updated.emit()
				break

# ── Input routing for game-over ──────────────────────────────
func _input(event):
	if game_over_screen and game_over_screen.visible:
		if event is InputEventKey and event.pressed:
			_send_results_and_exit()
		elif event is InputEventScreenTouch and event.pressed:
			_send_results_and_exit()

func _on_game_timer_timeout():
	Global.level_time -= 1
	Global.level_time_updated.emit()
	if Global.level_time <= 0 or Global.lives == 0:
		game_over()

func apply_effect(effect_name):
	match effect_name:
		"increase_score":
			Global.score += 1
			Global.score_updated.emit()
		"boost_jump":
			Global.jump_boost_count += 1
			Global.jump_boost_updated.emit()
		"decrease_time":
			if Global.level_time >= 10:
				Global.level_time -= 10
				Global.level_time_updated.emit()

func game_over():
	game_timer.stop()
	game_starts = false
	Global.game_started = false
	if main.level_music:
		main.level_music.stop()
	game_over_screen.visible = true
	if Global.lives <= 0:
		game_won = false
		game_results_label.text = "GAME OVER"
		if progress_button: progress_button.text = "EXIT"
		current_state = game_state.RETRY
		if level_fail_music: level_fail_music.play()
	else:
		game_won = true
		game_results_label.text = "TIME UP!"
		if progress_button: progress_button.text = "EXIT"
		current_state = game_state.CONTINUE
		if level_pass_music: level_pass_music.play()
	Global.update_results.emit()
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	_send_results()

func _send_results():
	if _results_sent:
		return
	_results_sent = true
	Global.send_results_to_js()

func _send_results_and_exit():
	_send_results()

func reset_game_state():
	is_jumping = false
	game_starts = false
	Global.game_started = false
	game_won = false
	game_over_screen.visible = false
	world.reset_world()
	get_tree().paused = false
	start_screen.visible = false
	if main.level_music: main.level_music.play()

func _on_progress_button_pressed():
	_send_results_and_exit()

# ── Outfit system ────────────────────────────────────────────

func _apply_outfit(outfit_name: String) -> void:
	_clear_outfit()
	if not skeleton:
		return
	match outfit_name:
		"default":
			_attach_backpack()
		"berlin":
			_attach_backpack()
			_attach_beanie()
		"bayern":
			_attach_backpack()
			_attach_bavarian_hat()
		"hamburg":
			_attach_backpack()
			_attach_rain_hat()

func _clear_outfit() -> void:
	for n in _outfit_nodes:
		if is_instance_valid(n):
			n.queue_free()
	_outfit_nodes.clear()

func _attach_to_bone(bone_name: String, mesh: Mesh, mat: Material, offset: Vector3 = Vector3.ZERO, scale_v: Vector3 = Vector3.ONE) -> void:
	if not skeleton:
		return
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

func _mat(color: Color, metallic_v: float = 0.0, roughness_v: float = 0.8) -> StandardMaterial3D:
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
	# Bavarian blue-white hat (Rauten pattern suggested by two-tone)
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
	# Gold band (Schwarz-Rot-Gold nod)
	var band := CylinderMesh.new()
	band.top_radius = 0.125
	band.bottom_radius = 0.125
	band.height = 0.025
	band.radial_segments = 12
	_attach_to_bone("mixamorig_Head", band, _mat(Color(0.85, 0.68, 0.0), 0.6, 0.3), Vector3(0, 0.135, 0))

func _attach_rain_hat() -> void:
	# Hamburg Südwester / rain hat — navy blue with red-gold band
	var brim := CylinderMesh.new()
	brim.top_radius = 0.20
	brim.bottom_radius = 0.16
	brim.height = 0.03
	brim.radial_segments = 12
	_attach_to_bone("mixamorig_Head", brim, _mat(Color(0.12, 0.15, 0.28)), Vector3(0, 0.12, 0))
	var dome := SphereMesh.new()
	dome.radius = 0.12
	dome.height = 0.14
	dome.radial_segments = 10
	dome.rings = 6
	_attach_to_bone("mixamorig_Head", dome, _mat(Color(0.12, 0.15, 0.28)), Vector3(0, 0.18, 0))
	# Red band
	var band := CylinderMesh.new()
	band.top_radius = 0.165
	band.bottom_radius = 0.165
	band.height = 0.02
	band.radial_segments = 12
	_attach_to_bone("mixamorig_Head", band, _mat(Color(0.85, 0.12, 0.08)), Vector3(0, 0.135, 0))
	# Gold trim
	var trim := CylinderMesh.new()
	trim.top_radius = 0.168
	trim.bottom_radius = 0.168
	trim.height = 0.01
	trim.radial_segments = 12
	_attach_to_bone("mixamorig_Head", trim, _mat(Color(0.85, 0.68, 0.0), 0.6, 0.3), Vector3(0, 0.148, 0))
