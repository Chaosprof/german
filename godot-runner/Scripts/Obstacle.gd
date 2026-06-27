### Obstacle.gd — typed street obstacle. Detection only (Area3D);
### the player script decides crash/stumble handling.

extends Area3D

# kind: "barrier" | "crates" (jump) | "gantry" (slide) |
#       "cart" | "bin" | "roadworks" (block) | "tram" (block, long)
var kind := "barrier"

const HITBOXES := {
	"barrier":   {"size": Vector3(1.9, 0.74, 0.34), "y": 0.40},
	"crates":    {"size": Vector3(1.7, 0.85, 0.70), "y": 0.46},
	"gantry":    {"size": Vector3(1.9, 0.85, 0.30), "y": 1.58},
	"cart":      {"size": Vector3(1.8, 2.0, 1.40), "y": 1.05},
	"bin":       {"size": Vector3(1.7, 1.7, 1.30), "y": 0.90},
	"roadworks": {"size": Vector3(1.8, 1.5, 0.55), "y": 0.80},
	"tram":      {"size": Vector3(2.0, 2.6, 12.4), "y": 1.30},
}

static func make(p_kind: String) -> Area3D:
	var ob: Area3D = load("res://Scripts/Obstacle.gd").new()
	ob.kind = p_kind
	return ob

func _ready() -> void:
	add_to_group("Obstacle")
	var mi := MeshInstance3D.new()
	mi.mesh = CityKit.tram_mesh() if kind == "tram" else CityKit.obstacle_mesh(kind)
	add_child(mi)
	var hb: Dictionary = HITBOXES[kind]
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = hb["size"]
	shape.shape = box
	shape.position = Vector3(0, hb["y"], 0)
	add_child(shape)
	body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node3D) -> void:
	if body.is_in_group("Player") and body.has_method("hit_obstacle"):
		body.hit_obstacle(self)
