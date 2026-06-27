### Main.gd — Artikel Runner bootstrap: environment, lighting, music, run flow.
### Auto-starts (embedded in the vocab app via iframe).

extends Node3D

@onready var track: Node3D = $Track
@onready var player: CharacterBody3D = $Player
@onready var hud: CanvasLayer = $HUD
@onready var music: AudioStreamPlayer = $Music

var _web := OS.has_feature("web")

func _ready() -> void:
	if _web:
		# WebGL2 is far more fill-rate limited than a desktop GPU. Drop the
		# multisample/AA passes that scale with screen resolution and cap the
		# frame rate so the browser tab never runs away into a stall.
		var vp := get_viewport()
		vp.msaa_3d = Viewport.MSAA_DISABLED
		vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_DISABLED
		Engine.max_fps = 60
	_setup_environment()
	Global.reset_run()
	hud.retry_requested.connect(_on_retry)
	hud.exit_requested.connect(_on_exit)
	music.volume_db = -10.0
	music.play()
	hud.play_countdown()

func _setup_environment() -> void:
	var env := Environment.new()
	# Bright stylised sky
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.25, 0.55, 0.92)
	sky_mat.sky_horizon_color = Color(0.78, 0.88, 0.98)
	sky_mat.sky_curve = 0.12
	sky_mat.ground_bottom_color = Color(0.55, 0.62, 0.72)
	sky_mat.ground_horizon_color = Color(0.78, 0.88, 0.98)
	sky_mat.sun_angle_max = 25.0
	sky_mat.sun_curve = 0.08
	var sky := Sky.new()
	sky.sky_material = sky_mat
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	# Ambient from sky, slightly boosted so shadows stay friendly
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_sky_contribution = 1.0
	env.ambient_light_energy = 1.0
	# Distance haze — hides spawn-in, adds depth (works on Compatibility)
	env.fog_enabled = true
	env.fog_mode = Environment.FOG_MODE_EXPONENTIAL
	env.fog_light_color = Color(0.78, 0.88, 1.0)
	env.fog_density = 0.004
	env.fog_sky_affect = 0.0
	# Punchy grade
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.15
	env.tonemap_white = 6.0
	# Glow (multi-pass bloom) and the colour-adjustment pass are the most
	# fill-rate-hungry effects here — skip them on WebGL2 to keep the frame time
	# low and avoid the lag/crash spiral. Desktop keeps the full juice.
	if not _web:
		env.glow_enabled = true
		env.glow_intensity = 0.5
		env.glow_strength = 0.9
		env.glow_bloom = 0.03
		env.glow_blend_mode = Environment.GLOW_BLEND_MODE_ADDITIVE
		env.glow_hdr_threshold = 1.2
		env.adjustment_enabled = true
		env.adjustment_brightness = 1.02
		env.adjustment_contrast = 1.07
		env.adjustment_saturation = 1.32
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	# Warm sun from high front-left so the character face is lit
	var sun := DirectionalLight3D.new()
	sun.light_color = Color(1.0, 0.95, 0.86)
	sun.light_energy = 1.45
	sun.rotation_degrees = Vector3(-38.0, 205.0, 0.0)
	sun.shadow_enabled = true
	sun.shadow_opacity = 0.45
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	# A shorter shadow range means a smaller shadow map to render each frame —
	# a cheap win on web where the city canyon fills the screen.
	sun.directional_shadow_max_distance = 45.0 if _web else 70.0
	sun.directional_shadow_split_1 = 0.18
	add_child(sun)

func _on_retry() -> void:
	hud.hide_gameover()
	Global.reset_run()
	player.reset_run()
	track.reset()
	music.play()
	hud.play_countdown()

func _on_exit() -> void:
	# Results were already posted on game over; tell the host we're done.
	if OS.has_feature("web"):
		JavaScriptBridge.eval("window.parent.postMessage({type:'exit_game'}, '*')")
	else:
		get_tree().quit()
