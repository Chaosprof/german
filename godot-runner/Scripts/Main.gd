### Main.gd — Artikel Runner
### Auto-starts the game (no menu) for iframe embedding.

extends Node3D

# Node Refs — menu is kept for compatibility but hidden immediately
@onready var menu = get_node_or_null("Menu")
@onready var world = $World
@onready var player = $Player
@onready var button_start = get_node_or_null("Menu/Container/ButtonStart")
@onready var level_label = get_node_or_null("Menu/Container/LevelLabel")
@onready var menu_music = get_node_or_null("Sounds/MenuMusic")
@onready var level_music = get_node_or_null("Sounds/LevelMusic")

func _ready():
	# Reset session counters BEFORE Player._ready reads them.
	# Actually Player runs before Main (children first), so do it here anyway
	# and re-emit so HUD refreshes.
	Global.score = 0
	Global.lives = 1000  # TEMP: high lives for controls testing
	Global.level_time = 120  # 2 minutes per session
	Global.score_updated.emit()
	Global.lives_updated.emit()
	Global.level_time_updated.emit()

	# Initialize word queue from JS (or default list) and broadcast first word
	Global.init_word_queue()

	# Skip the menu — embedded in the React app
	if menu:
		menu.visible = false
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	if menu_music:
		menu_music.stop()
	if level_music:
		level_music.play()

# Keep signal-connected callbacks as no-op shims
func _on_button_start_pressed():
	if menu:
		menu.visible = false
	if menu_music:
		menu_music.stop()
	if level_music:
		level_music.play()
	get_tree().paused = false

func _on_button_load_pressed():
	_on_button_start_pressed()

func _on_button_exit_pressed():
	get_tree().quit()

# Disable pause menu on web (no way to return from pause in iframe)
func _input(event):
	pass
