### Shots.gd — debug harness (no-op unless launched with --shots=<dir>)
### Usage: godot --path . -- --shots=C:/abs/dir [--shot-end=16] [--bot=0]
### An auto-pilot plays the game (steers to correct gates, jumps/slides/dodges)
### while numbered PNG frames are captured for visual review.

extends Node

var _dir: String = ""
var _t: float = 0.0
var _end_t: float = 16.0
var _bot := true
var _shot_times: Array = [0.5, 2.0, 4.0, 6.0, 8.0, 9.5, 11.0, 12.5, 14.0]
var _shot_idx: int = 0
var _active := false
var _steer_cd := 0.0
var _action_release: Array = []   # actions to release next frame
var _retried := false             # validate the retry flow once per session

func _ready() -> void:
	if OS.has_feature("web"):
		return
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--shots="):
			_dir = arg.get_slice("=", 1)
		elif arg.begins_with("--shot-end="):
			_end_t = float(arg.get_slice("=", 1))
		elif arg.begins_with("--bot="):
			_bot = arg.get_slice("=", 1) != "0"
	if _dir == "":
		return
	_active = true
	DirAccess.make_dir_recursive_absolute(_dir)

func _process(delta: float) -> void:
	if not _active:
		return
	_t += delta
	if _shot_idx < _shot_times.size() and _t >= _shot_times[_shot_idx]:
		var img := get_viewport().get_texture().get_image()
		img.save_png("%s/shot_%02d_t%04.1f.png" % [_dir, _shot_idx, _shot_times[_shot_idx]])
		_shot_idx += 1
	if not Global.running and not _retried and _t > 1.0:
		_retried = true
		_do_retry_check()
	if _t >= _end_t:
		_active = false
		get_tree().quit()

func _do_retry_check() -> void:
	await get_tree().create_timer(0.5).timeout
	var img := get_viewport().get_texture().get_image()
	img.save_png("%s/gameover.png" % _dir)
	var hud := get_node_or_null("/root/Main/HUD")
	if hud:
		hud.retry_requested.emit()
		await get_tree().create_timer(2.5).timeout
		var img2 := get_viewport().get_texture().get_image()
		img2.save_png("%s/after_retry.png" % _dir)

func _physics_process(delta: float) -> void:
	if not _active or not _bot:
		return
	for a in _action_release:
		Input.action_release(a)
	_action_release.clear()
	_steer_cd -= delta
	var player := get_tree().get_first_node_in_group("Player")
	if player == null:
		return
	if not Global.running:
		return
	var pz: float = player.global_position.z
	var lane: int = player.current_lane

	# 1) Obstacle ahead in my lane?
	var nearest: Node3D = null
	var nearest_d := INF
	for ob in get_tree().get_nodes_in_group("Obstacle"):
		var oz: float = ob.global_position.z
		var dz := oz - pz
		var lane_d: float = absf(ob.global_position.x - CityKit.LANE_X[lane])
		if ob.kind == "tram":
			dz = (oz - 6.5) - pz   # react to the tram nose, not its centre
		if dz > 0.5 and dz < 11.0 and lane_d < 1.0 and dz < nearest_d:
			nearest = ob
			nearest_d = dz
	if nearest != null:
		var kind: String = nearest.kind
		if kind == "barrier" or kind == "crates":
			if nearest_d < 5.0:
				_tap("ui_jump")
			return
		elif kind == "gantry":
			if nearest_d < 4.0:
				_tap("ui_slide")
			return
		else:
			# Hard block — find a safe adjacent lane
			if _steer_cd <= 0.0:
				var options: Array = []
				if lane > 0: options.append(lane - 1)
				if lane < 2: options.append(lane + 1)
				var best_lane := -1
				for cand in options:
					if _lane_clear(cand, pz):
						best_lane = cand
						break
				if best_lane >= 0:
					_tap("ui_left" if best_lane < lane else "ui_right")
					_steer_cd = 0.3
			return

	# 2) Steer toward the correct gate lane
	var gate: Node3D = null
	var gd := INF
	for g in get_tree().get_nodes_in_group("Gate"):
		var dz: float = g.global_position.z - pz
		if dz > 1.0 and dz < 50.0 and dz < gd and not g._answered:
			gate = g
			gd = dz
	if gate != null and _steer_cd <= 0.0:
		var target_article: String = String(gate.word.get("article", "der"))
		var target_lane: int = gate.lane_articles.find(target_article)
		if target_lane >= 0 and target_lane != lane and gd < 34.0:
			# Only move if the path lane is clear right now
			var step: int = lane + (1 if target_lane > lane else -1)
			if _lane_clear(step, pz):
				_tap("ui_right" if target_lane > lane else "ui_left")
				_steer_cd = 0.28

func _lane_clear(cand: int, pz: float) -> bool:
	for ob in get_tree().get_nodes_in_group("Obstacle"):
		var dz: float = ob.global_position.z - pz
		var span := 7.0
		if ob.kind == "tram":
			if absf(ob.global_position.x - CityKit.LANE_X[cand]) < 1.0 and dz > -6.0 and dz < 14.0:
				return false
			continue
		if absf(ob.global_position.x - CityKit.LANE_X[cand]) < 1.0 and dz > -0.5 and dz < span:
			if ob.kind in ["cart", "bin", "roadworks"]:
				return false
	return true

func _tap(action: String) -> void:
	Input.action_press(action)
	_action_release.append(action)
