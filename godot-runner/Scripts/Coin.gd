### Coin.gd — spinning collectible with light magnet pull.

extends Area3D

var _t := randf() * TAU
var _base_y := 0.0
var _collected := false
var _player: Node3D = null

func _ready() -> void:
	var mi := MeshInstance3D.new()
	mi.mesh = CityKit.coin_mesh()
	add_child(mi)
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(1.0, 1.4, 0.6)
	shape.shape = box
	add_child(shape)
	_base_y = position.y
	body_entered.connect(_on_body_entered)
	monitoring = true

func _process(delta: float) -> void:
	_t += delta
	rotate_y(delta * 3.2)
	if not _collected:
		position.y = _base_y + sin(_t * 2.4) * 0.08

func _physics_process(delta: float) -> void:
	if _collected:
		return
	if _player == null:
		_player = get_tree().get_first_node_in_group("Player")
		if _player == null:
			return
	# Light magnet: pull toward the player when close
	var to_p: Vector3 = _player.global_position + Vector3(0, 0.8, 0) - global_position
	var d := to_p.length()
	if d < 1.8 and abs(to_p.z) < 1.8:
		global_position += to_p.normalized() * minf(16.0 * delta, d)

func _on_body_entered(body: Node3D) -> void:
	if _collected or not body.is_in_group("Player"):
		return
	_collected = true
	Global.add_coin()
	if body.has_method("on_coin_collected"):
		body.on_coin_collected(global_position)
	# Pop animation then free
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(self, "scale", Vector3.ONE * 1.25, 0.08)
	tw.tween_property(self, "position:y", position.y + 0.5, 0.10)
	tw.chain().tween_property(self, "scale", Vector3.ONE * 0.01, 0.07)
	tw.chain().tween_callback(queue_free)
