### Gate.gd — der/die/das answer gate spanning the three lanes.
### Each lane gets an arch with a (shuffled) article; running through an arch
### answers the current word. Impossible to skip: the trigger spans the road.

extends Node3D

signal answered(gate: Node3D, correct: bool)

var word: Dictionary = {}
var lane_articles: Array = []       # article per lane index 0..2
var _answered := false
var _arches: Array = []             # MeshInstance3D per lane
var _word_label: Label3D

static var _font: Font = null

static func _get_font() -> Font:
	if _font == null:
		_font = load("res://Assets/Fonts/droid-sans/DroidSans-Bold.ttf")
	return _font

func setup(p_word: Dictionary) -> void:
	word = p_word

func _ready() -> void:
	add_to_group("Gate")
	lane_articles = Global.ARTICLES.duplicate()
	lane_articles.shuffle()
	for i in 3:
		var article: String = lane_articles[i]
		var arch := MeshInstance3D.new()
		arch.mesh = CityKit.gate_arch_mesh(article)
		arch.position = Vector3(CityKit.LANE_X[i], 0, 0)
		add_child(arch)
		_arches.append(arch)
		var lbl := Label3D.new()
		lbl.text = article
		lbl.font = _get_font()
		lbl.font_size = 190
		lbl.pixel_size = 0.004
		lbl.outline_size = 24
		lbl.outline_modulate = Color(0, 0, 0, 0.85)
		lbl.modulate = Color.WHITE
		lbl.position = Vector3(CityKit.LANE_X[i], 2.98, -0.20)
		lbl.rotation.y = PI   # face the approaching player
		lbl.no_depth_test = false
		add_child(lbl)
	# Floating word above the centre
	_word_label = Label3D.new()
	_word_label.text = String(word.get("noun", ""))
	_word_label.font = _get_font()
	_word_label.font_size = 300
	_word_label.pixel_size = 0.004
	_word_label.outline_size = 30
	_word_label.outline_modulate = Color(0.08, 0.10, 0.18, 0.9)
	_word_label.modulate = Color(1.0, 0.96, 0.75)
	_word_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_word_label.position = Vector3(0, 4.6, 0)
	add_child(_word_label)
	# Full-width trigger, slightly before the arch plane so the verdict
	# lands as the player enters rather than mid-arch.
	var area := Area3D.new()
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(CityKit.ROAD_HALF * 2.2, 5.0, 0.5)
	shape.shape = box
	shape.position = Vector3(0, 2.5, -1.3)
	area.add_child(shape)
	add_child(area)
	area.body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node3D) -> void:
	if _answered or not body.is_in_group("Player"):
		return
	_answered = true
	# Determine lane from player x
	var px: float = body.global_position.x
	var lane := 0
	var best := INF
	for i in 3:
		var d: float = absf(px - CityKit.LANE_X[i])
		if d < best:
			best = d
			lane = i
	var picked: String = lane_articles[lane]
	var correct: bool = Global.record_answer(word, picked)
	_flash(lane, correct)
	if body.has_method("on_gate_answered"):
		body.on_gate_answered(correct)
	answered.emit(self, correct)

func _flash(lane: int, correct: bool) -> void:
	var col := Color(0.25, 1.0, 0.45) if correct else Color(1.0, 0.22, 0.18)
	var arch: MeshInstance3D = _arches[lane]
	arch.material_override = CityKit.mat_glow(col, 1.7)
	_word_label.modulate = col
	_burst(Vector3(CityKit.LANE_X[lane], 1.6, 0), col, 60 if correct else 36)
	# Fade the whole gate out as the player passes so the flash never
	# fills the screen; the labels go first.
	for child in get_children():
		if child is Label3D:
			var twl := create_tween()
			twl.tween_property(child, "modulate:a", 0.0, 0.30).set_delay(0.12)
	for i in 3:
		var a: MeshInstance3D = _arches[i]
		var tw := create_tween()
		tw.tween_property(a, "transparency", 0.55 if i == lane else 0.85, 0.35).set_delay(0.15)

func _burst(pos: Vector3, color: Color, amount: int) -> void:
	var p := GPUParticles3D.new()
	var mat := ParticleProcessMaterial.new()
	mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	mat.emission_sphere_radius = 0.4
	mat.direction = Vector3(0, 1, 0)
	mat.spread = 75.0
	mat.initial_velocity_min = 3.0
	mat.initial_velocity_max = 7.5
	mat.gravity = Vector3(0, -7, 0)
	mat.scale_min = 0.5
	mat.scale_max = 1.0
	var curve := Curve.new()
	curve.add_point(Vector2(0.0, 1.0))
	curve.add_point(Vector2(1.0, 0.0))
	var ct := CurveTexture.new()
	ct.curve = curve
	mat.scale_curve = ct
	p.process_material = mat
	var quad := QuadMesh.new()
	quad.size = Vector2(0.16, 0.16)
	var qm := StandardMaterial3D.new()
	qm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	qm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	qm.albedo_color = color
	qm.albedo_texture = CityKit.soft_dot()
	qm.emission_enabled = true
	qm.emission = color
	qm.emission_energy_multiplier = 2.0
	qm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	quad.material = qm
	p.draw_pass_1 = quad
	p.amount = amount
	p.lifetime = 0.7
	p.one_shot = true
	p.explosiveness = 1.0
	p.position = pos
	add_child(p)
	p.emitting = true
