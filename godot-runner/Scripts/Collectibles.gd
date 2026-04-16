### Collectibles.gd — Artikel Runner version
### The collectible represents an article (der/die/das).
### Player collects one per "row"; the first coin in the row decides the answer.

extends Area3D

const ARTICLE_COLORS := {
	"der": Color(0.25, 0.50, 1.0),
	"die": Color(1.0, 0.25, 0.50),
	"das": Color(0.25, 1.0, 0.55),
}

var article_name: String = ""
var collectibles_container: Node3D = null
var label_3d: Label3D = null
# Shared, per-frame answer lock: once any coin in the current row is touched,
# further coins from the same row shouldn't trigger a second scoring event.
static var _last_answer_frame: int = -1

func _on_body_entered(body):
	if not body.is_in_group("Player"):
		return
	# Prevent multiple coins on the same row from all firing in one frame
	var f: int = Engine.get_process_frames()
	if f == _last_answer_frame:
		queue_free()
		return
	_last_answer_frame = f
	Global.record_article_answer(article_name)
	# Despawn all coins from the current row (siblings)
	var parent := get_parent()
	if parent:
		for sib in parent.get_children():
			if sib is Area3D and sib.has_method("mark_consumed"):
				sib.mark_consumed()
	queue_free()

func mark_consumed():
	# Called on sibling coins to make them disappear at the same moment
	queue_free()

# Instantiate the 3D coin model + label
func set_collectible_type(article: String):
	article_name = article
	collectibles_container = $Collectible
	# Use the existing coin.tscn mesh (visual only — the article text identifies it)
	var coin_res: PackedScene = Global.collectibles_resources["coin"]["scene"]
	var coin_item: Node = coin_res.instantiate()
	collectibles_container.add_child(coin_item)
	# Tint the coin to the article color
	_tint_children(coin_item, ARTICLE_COLORS.get(article, Color.WHITE))
	# Add article text label floating above the coin
	label_3d = Label3D.new()
	label_3d.text = article
	label_3d.font_size = 128
	label_3d.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label_3d.modulate = Color.WHITE
	label_3d.outline_modulate = Color(0, 0, 0, 1)
	label_3d.outline_size = 14
	label_3d.no_depth_test = true
	label_3d.pixel_size = 0.004
	label_3d.position = Vector3(0, 0.8, 0)
	add_child(label_3d)

func _tint_children(node: Node, color: Color):
	if node is MeshInstance3D:
		var mi: MeshInstance3D = node
		# Create a material override so we don't mutate the shared mesh material
		var mat := StandardMaterial3D.new()
		mat.albedo_color = color
		mat.metallic = 0.8
		mat.roughness = 0.25
		mat.emission_enabled = true
		mat.emission = color * 0.5
		mat.emission_energy_multiplier = 0.8
		mi.material_override = mat
	for child in node.get_children():
		_tint_children(child, color)
