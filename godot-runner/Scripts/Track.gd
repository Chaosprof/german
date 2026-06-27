### Track.gd — endless chunk-based street generator.
### Builds the German-city canyon, obstacle patterns, coins, and article gates.

extends Node3D

const CHUNK := CityKit.CHUNK
const SPAWN_AHEAD := 170.0
const CULL_BEHIND := 30.0
const GATE_EVERY := 5          # gate every N chunks
const RUNUP_CHUNKS := 3        # obstacle-free chunks at the start

var player: Node3D
var rng := RandomNumberGenerator.new()

var _next_z := 0.0
var _chunk_idx := 0
var _chunks: Array = []                 # {z, node, gate}
var _bcursor := {-1: 0.0, 1: 0.0}       # building fill cursor per side
var _pending_gates: Array = []
var _backdrop: Node3D
var _floor: StaticBody3D

func _ready() -> void:
	rng.randomize()
	player = get_tree().get_first_node_in_group("Player")
	_prewarm_meshes()
	_build_floor()
	_build_backdrop()
	_fill_ahead()
	_update_active_word()

# Build every cached mesh up front so first spawns never hitch mid-run
func _prewarm_meshes() -> void:
	CityKit.building_variants()
	CityKit.ground_chunk(false)
	CityKit.ground_chunk(true)
	CityKit.coin_mesh()
	CityKit.tram_mesh()
	CityKit.backdrop_mesh()
	CityKit.soft_dot()
	for kind in ["barrier", "crates", "gantry", "cart", "bin", "roadworks"]:
		CityKit.obstacle_mesh(kind)
	for article in Global.ARTICLES:
		CityKit.gate_arch_mesh(article)
	for p in ["lamp", "tree", "umbrella", "litfass", "bench", "ubahn", "hydrant", "bollard", "flowerbox"]:
		CityKit.prop(p)

func reset() -> void:
	for c in _chunks:
		c["node"].queue_free()
	_chunks.clear()
	_pending_gates.clear()
	_next_z = 0.0
	_chunk_idx = 0
	_bcursor = {-1: 0.0, 1: 0.0}
	_fill_ahead()
	_update_active_word()

func _physics_process(_delta: float) -> void:
	if player == null:
		return
	_fill_ahead()
	_cull_behind()
	_backdrop.position.z = player.global_position.z + 215.0

func _fill_ahead() -> void:
	var target: float = (player.global_position.z if player else 0.0) + SPAWN_AHEAD
	while _next_z < target:
		_spawn_chunk()

func _cull_behind() -> void:
	var min_z: float = player.global_position.z - CULL_BEHIND
	while _chunks.size() > 0 and _chunks[0]["z"] + CHUNK < min_z:
		var c = _chunks.pop_front()
		c["node"].queue_free()

# ── Floor & backdrop ─────────────────────────────────────────────────
func _build_floor() -> void:
	_floor = StaticBody3D.new()
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(14, 1.0, 12000)
	shape.shape = box
	shape.position = Vector3(0, -0.5, 5800)
	_floor.add_child(shape)
	add_child(_floor)

func _build_backdrop() -> void:
	_backdrop = Node3D.new()
	var mi := MeshInstance3D.new()
	mi.mesh = CityKit.backdrop_mesh()
	_backdrop.add_child(mi)
	# Puffy clouds at varying heights
	for i in 7:
		var cl := MeshInstance3D.new()
		cl.mesh = CityKit.cloud_mesh(i * 31 + 5)
		cl.position = Vector3(-70 + i * 24 + (i % 3) * 7, 32 + (i % 4) * 9, -20 + (i % 2) * 24)
		cl.scale = Vector3.ONE * (1.4 + (i % 3) * 0.5)
		_backdrop.add_child(cl)
	add_child(_backdrop)

# ── Chunk spawning ───────────────────────────────────────────────────
func _spawn_chunk() -> void:
	var idx := _chunk_idx
	_chunk_idx += 1
	var z0 := _next_z
	_next_z += CHUNK

	var node := Node3D.new()
	node.position = Vector3(0, 0, z0)
	add_child(node)
	var entry := {"z": z0, "node": node, "gate": null}

	# Ground
	var ground := MeshInstance3D.new()
	ground.mesh = CityKit.ground_chunk(idx % 5 == 2)
	node.add_child(ground)

	# Buildings (cursors run in world z, children parented to chunks for culling)
	for side in [-1, 1]:
		while _bcursor[side] < z0 + CHUNK + 10.0:
			_place_building(node, side, _bcursor[side] - z0)
			_bcursor[side] += 10.0 + rng.randf_range(0.0, 1.2)

	# Sidewalk props
	_place_props(node, idx)

	# Content
	if idx >= RUNUP_CHUNKS:
		if idx % GATE_EVERY == 0:
			_place_gate(entry, node)
		else:
			_place_obstacles_and_coins(node, idx)

	_chunks.append(entry)

func _place_building(parent: Node3D, side: int, local_z: float) -> void:
	var variants := CityKit.building_variants()
	var v: Dictionary = variants[rng.randi() % variants.size()]
	var mi := MeshInstance3D.new()
	mi.mesh = v["mesh"]
	var bx: float = (CityKit.ROAD_HALF + CityKit.WALK_W + 0.5 + v["width"] * 0.5) * side
	mi.position = Vector3(bx, 0, local_z + 5.0)
	if side < 0:
		mi.rotation.y = PI
	parent.add_child(mi)

func _place_props(parent: Node3D, idx: int) -> void:
	var walk_x := CityKit.ROAD_HALF + 1.2
	var lamp_side := -1 if idx % 2 == 0 else 1
	_prop(parent, "lamp", Vector3(walk_x * lamp_side, 0.15, 4.0), PI * 0.5 * (1 - lamp_side))
	# Trees opposite the lamp
	_prop(parent, "tree", Vector3(walk_x * -lamp_side, 0.15, 8.0 + (idx % 3)))
	match idx % 7:
		0: _prop(parent, "litfass", Vector3(walk_x * lamp_side, 0.15, 9.0))
		1: _prop(parent, "bench", Vector3((walk_x + 0.6) * -lamp_side, 0.15, 3.0), PI * 0.5 * (1 + lamp_side))
		2: _prop(parent, "umbrella", Vector3((walk_x + 0.9) * lamp_side, 0.15, 7.5))
		3: _prop(parent, "ubahn", Vector3(walk_x * -lamp_side, 0.15, 5.0))
		4: _prop(parent, "hydrant", Vector3(walk_x * lamp_side, 0.15, 7.0))
		5: _prop(parent, "flowerbox", Vector3((walk_x + 1.4) * lamp_side, 0.15, 2.0))
		6: _prop(parent, "umbrella", Vector3((walk_x + 0.9) * -lamp_side, 0.15, 10.0))
	# Curb bollards
	for bz in [2.0, 6.0, 10.0]:
		_prop(parent, "bollard", Vector3((CityKit.ROAD_HALF + 0.45) * (1 if int(bz) % 4 == 2 else -1), 0.15, bz))

func _prop(parent: Node3D, kind: String, pos: Vector3, rot_y := 0.0) -> void:
	var mi := MeshInstance3D.new()
	mi.mesh = CityKit.prop(kind)
	mi.position = pos
	mi.rotation.y = rot_y
	parent.add_child(mi)

# ── Gates ────────────────────────────────────────────────────────────
func _place_gate(entry: Dictionary, parent: Node3D) -> void:
	var gate: Node3D = load("res://Scripts/Gate.gd").new()
	gate.setup(Global.take_next_word())
	gate.position = Vector3(0, 0, 6.0)
	parent.add_child(gate)
	gate.answered.connect(_on_gate_answered)
	entry["gate"] = gate
	_pending_gates.append(gate)
	# A short coin lead-in line in the centre
	for i in 3:
		_coin(parent, Vector3(0, 0.95, 1.2 + i * 1.4))

func _on_gate_answered(gate: Node3D, _correct: bool) -> void:
	_pending_gates.erase(gate)
	_update_active_word()

func _update_active_word() -> void:
	if _pending_gates.size() > 0:
		Global.set_active_word(_pending_gates[0].word)

# ── Obstacles & coins ────────────────────────────────────────────────
func _place_obstacles_and_coins(parent: Node3D, idx: int) -> void:
	var difficulty: float = clampf((idx - RUNUP_CHUNKS) / 45.0, 0.0, 1.0)
	var blocked: Array = [[], []]      # blocked lanes per row (for coin placement)
	var full_row := false

	# Tram chunk (one lane occupied along the whole chunk)
	if idx > 12 and rng.randf() < 0.10 + difficulty * 0.08:
		var lane := rng.randi_range(0, 2)
		_obstacle(parent, "tram", lane, 6.0)
		_coin_line(parent, _pick_free_lane([lane]), 2.0, 5)
		return

	var rows := 1
	if rng.randf() < 0.25 + difficulty * 0.55:
		rows = 2
	var row_z := [4.0, 9.5]
	for r in rows:
		if full_row:
			break
		var roll := rng.randf()
		if roll < 0.16:
			# Full-width jump row (fence across all lanes)
			for lane in 3:
				_obstacle(parent, "barrier", lane, row_z[r])
			_coin_arc(parent, rng.randi_range(0, 2), row_z[r])
			full_row = true
			blocked[r] = []
		elif roll < 0.26 and difficulty > 0.15:
			# Full-width slide row
			for lane in 3:
				_obstacle(parent, "gantry", lane, row_z[r])
			full_row = true
			blocked[r] = []
		else:
			# 1–2 lane obstacles, keep at least one lane clear
			var lanes := [0, 1, 2]
			lanes.shuffle()
			var n: int = 1 if rng.randf() > 0.30 + difficulty * 0.45 else 2
			for i in n:
				var kind := _pick_kind(difficulty)
				_obstacle(parent, kind, lanes[i], row_z[r])
				if kind in ["cart", "bin", "roadworks"]:
					blocked[r].append(lanes[i])
	# Coins along a lane that is never hard-blocked this chunk
	var bad: Array = []
	for b in blocked:
		for l in b:
			bad.append(l)
	if not full_row and rng.randf() < 0.8:
		_coin_line(parent, _pick_free_lane(bad), 1.5, 5 + rng.randi_range(0, 2))

func _pick_kind(difficulty: float) -> String:
	var r := rng.randf()
	if r < 0.30:
		return "barrier" if rng.randf() < 0.6 else "crates"
	elif r < 0.50:
		return "gantry"
	elif r < 0.80:
		return ["cart", "bin", "roadworks"][rng.randi() % 3]
	elif difficulty > 0.3 and r < 0.9:
		return "roadworks"
	return "barrier"

func _pick_free_lane(bad: Array) -> int:
	var options := []
	for l in 3:
		if not bad.has(l):
			options.append(l)
	if options.is_empty():
		return 1
	return options[rng.randi() % options.size()]

func _obstacle(parent: Node3D, kind: String, lane: int, local_z: float) -> void:
	var ob: Area3D = load("res://Scripts/Obstacle.gd").new()
	ob.kind = kind
	ob.position = Vector3(CityKit.LANE_X[lane], 0, local_z)
	parent.add_child(ob)

func _coin(parent: Node3D, pos: Vector3) -> void:
	var c: Area3D = load("res://Scripts/Coin.gd").new()
	c.position = pos
	parent.add_child(c)

func _coin_line(parent: Node3D, lane: int, z0: float, n: int) -> void:
	for i in n:
		_coin(parent, Vector3(CityKit.LANE_X[lane], 0.95, z0 + i * 1.5))

func _coin_arc(parent: Node3D, lane: int, over_z: float) -> void:
	# Parabolic arc over a jump obstacle
	for i in 5:
		var t := i / 4.0
		var dz := (t - 0.5) * 4.4
		var y := 0.95 + (1.0 - pow((t - 0.5) * 2.0, 2)) * 1.35
		_coin(parent, Vector3(CityKit.LANE_X[lane], y, over_z + dz))
