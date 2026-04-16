### HUD.gd — Artikel Runner

extends CanvasLayer

# Node refs (use get_node_or_null so missing nodes don't crash)
@onready var score_label: Label = get_node_or_null("Score/ReferenceRect/Label")
@onready var level_time_label: Label = get_node_or_null("Time/ReferenceRect/Label")
@onready var jump_boost_label: Label = get_node_or_null("Jump/ReferenceRect/Label")
@onready var lives_sprite: Sprite2D = get_node_or_null("Lives/Sprite2D")
@onready var level_label: Label = get_node_or_null("Level/ReferenceRect/Label")
@onready var level_results_label: Label = get_node_or_null("GameOverScreen/Container/Results/Level")
@onready var score_results_label: Label = get_node_or_null("GameOverScreen/Container/Results/Score")

# Artikel Runner: large German word at the top of the screen
var word_label: Label = null

func _ready():
	_build_word_label()

	Global.score_updated.connect(_update_score)
	Global.level_time_updated.connect(_update_time)
	Global.jump_boost_updated.connect(_update_jump_boost)
	Global.lives_updated.connect(_update_lives)
	Global.level_updated.connect(_update_level)
	Global.update_results.connect(_update_results)
	Global.current_word_updated.connect(_update_word)

	_update_score()
	_update_time()
	_update_jump_boost()
	_update_lives()
	_update_level()
	_update_results()
	_update_word()

func _build_word_label():
	word_label = Label.new()
	word_label.name = "GermanWord"
	word_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	word_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	word_label.set_anchors_preset(Control.PRESET_TOP_WIDE)
	word_label.offset_top = 20
	word_label.offset_bottom = 110
	word_label.add_theme_font_size_override("font_size", 64)
	word_label.add_theme_color_override("font_color", Color.WHITE)
	word_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 1))
	word_label.add_theme_constant_override("outline_size", 10)
	add_child(word_label)

func _update_word():
	if word_label:
		word_label.text = Global.current_word.get("noun", "")

# Score UI
func _update_score():
	if score_label:
		score_label.text = str(Global.score)

# Time UI
func _update_time():
	if not level_time_label:
		return
	var total_seconds: int = int(Global.level_time)
	var minutes: int = total_seconds / 60
	var seconds: int = total_seconds % 60
	level_time_label.text = "%02d:%02d" % [minutes, seconds]

# Jump UI (unused in Artikel Runner)
func _update_jump_boost():
	if jump_boost_label:
		jump_boost_label.text = str(Global.jump_boost_count)

# Lives UI
func _update_lives():
	if not lives_sprite:
		return
	if Global.lives >= 3:
		lives_sprite.texture = preload("res://Assets/Icons/HeartFull.png")
	elif Global.lives == 2:
		lives_sprite.texture = preload("res://Assets/Icons/HeartHalf.png")
	else:
		lives_sprite.texture = preload("res://Assets/Icons/HeartEmpty.png")

# Level UI
func _update_level():
	if level_label:
		level_label.text = str("LVL: ", Global.level)

# Game Over Screen UI
func _update_results():
	if level_results_label:
		level_results_label.text = str("Level: ", Global.level)
	if score_results_label:
		score_results_label.text = str("Score: ", Global.score, " / ", Global.score_requirement)
