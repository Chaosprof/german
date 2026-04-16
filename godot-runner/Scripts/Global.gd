### Global.gd

extends Node

# Platform Resources
var platform_resources = [
	preload("res://Resources/Platforms/dirt_platform.tscn"),
	preload("res://Resources/Platforms/grass_platform.tscn"),
	preload("res://Resources/Platforms/wood_platform.tscn")
]

# Air Platform Resources
var air_platforms_resources = [
	preload("res://Resources/Platforms/air_platform.tscn")
]
var air_platform_spawn_chance = 0.5

# Obstacle Resources
var obstacle_resources = [
	preload("res://Resources/Obstacles/crate.tscn"),
	preload("res://Resources/Obstacles/rock_1.tscn"),
	preload("res://Resources/Obstacles/rock_2.tscn"),
	preload("res://Resources/Obstacles/rock_3.tscn"),
	preload("res://Resources/Obstacles/tree_stump.tscn"),
]
var obstacle_scene = preload("res://Scenes/Obstacles.tscn")
var obstacle_spawn_chance = 0.5

# Environmental Resources
var environment_resources = {
	"clouds": [
		preload("res://Resources/Environmentals/cloud_1.tscn"),
		preload("res://Resources/Environmentals/cloud_2.tscn"),
		preload("res://Resources/Environmentals/cloud_3.tscn")
		],
	"ground": [
		preload("res://Resources/Environmentals/lilypad.tscn")
		],
	"water": [
		preload("res://Resources/Environmentals/water_4.tscn")
	]
}

# Collectible resources
var collectibles_resources = {
	"coin": {
		"scene": preload("res://Resources/Collectibles/coin.tscn"),
		"effect": "increase_score",
		"spawn_chance": 0.07
	},
	"gem": {
		"scene": preload("res://Resources/Collectibles/gem.tscn"),
		"effect": "boost_jump",
		"spawn_chance": 0.04
	},
	"flag": {
		"scene": preload("res://Resources/Collectibles/flag.tscn"),
		"effect": "decrease_time",
		"spawn_chance": 0.02
	}
}
var collectible_scene = preload("res://Scenes/Collectibles.tscn")

# Advanced Obstacles
var advanced_obstacle_resources = [
	preload("res://Resources/AdvancedObstacles/bee.tscn"),
	preload("res://Resources/AdvancedObstacles/rotating_log.tscn")
]
var advanced_obstacle_spawn_chance = 0

# Level variables
var score = 0
var level_time = 120  # longer for endless-word practice
var jump_boost_count = 0
var lives = 1000  # TEMP: high lives for controls testing
var level = 1
var game_started = false

# ── Artikel Runner: der/die/das word tracking ──────────────────────────
const ARTICLES := ["der", "die", "das"]
var DEFAULT_WORDS := [
	{"noun": "Hund", "article": "der"},
	{"noun": "Katze", "article": "die"},
	{"noun": "Buch", "article": "das"},
	{"noun": "Tisch", "article": "der"},
	{"noun": "Lampe", "article": "die"},
	{"noun": "Auto", "article": "das"},
	{"noun": "Stuhl", "article": "der"},
	{"noun": "Blume", "article": "die"},
	{"noun": "Fenster", "article": "das"},
	{"noun": "Baum", "article": "der"},
	{"noun": "Sonne", "article": "die"},
	{"noun": "Kind", "article": "das"},
	{"noun": "Berg", "article": "der"},
	{"noun": "Straße", "article": "die"},
	{"noun": "Wasser", "article": "das"},
	{"noun": "Apfel", "article": "der"},
	{"noun": "Milch", "article": "die"},
	{"noun": "Brot", "article": "das"},
	{"noun": "Schuh", "article": "der"},
	{"noun": "Uhr", "article": "die"},
	{"noun": "Geld", "article": "das"},
	{"noun": "Fisch", "article": "der"},
	{"noun": "Tür", "article": "die"},
	{"noun": "Bier", "article": "das"},
	{"noun": "Mond", "article": "der"},
	{"noun": "Nacht", "article": "die"},
	{"noun": "Herz", "article": "das"},
	{"noun": "Vogel", "article": "der"},
	{"noun": "Stadt", "article": "die"},
	{"noun": "Mädchen", "article": "das"},
]
var word_queue: Array = []
var word_idx: int = 0
var current_word: Dictionary = {"noun": "", "article": "der"}
var correct_count: int = 0
var wrong_count: int = 0
var session_results: Array = []

signal current_word_updated

# Signals
signal score_updated
signal level_time_updated
signal jump_boost_updated
signal lives_updated
signal level_updated
signal update_results

# Progression Variables
var obstacle_spawn_increase_per_level = 0.05
var score_requirement = 0 
var min_score_requirement = 10
var max_score_requirement = 50 
var final_score_requirement = 0
var score_requirement_reached = false
var time_reduction_bonus = 10
var default_level_time = 20  # Starting time for level 1

# New Game
func new_game():
	reset_default_values()
	level = 1
	level_time = default_level_time
	obstacle_spawn_chance = 0.5
	advanced_obstacle_spawn_chance = 0
	save_game() 
	
# Level Pass
func level_up():
	# Increase level and spawn chances
	level += 1
	obstacle_spawn_chance = min(obstacle_spawn_chance + obstacle_spawn_increase_per_level * (level - 1), 1.0)
	advanced_obstacle_spawn_chance += obstacle_spawn_increase_per_level
	# Check if the score in the previous level met the requirement
	if score >= score_requirement:
		score_requirement_reached = true
	# Reset for next level
	reset_default_values()
	# Save game
	save_game()

# Level Fail
func retry_level():
	reset_default_values()
	# Save game
	save_game()
	
# Level Reset
func reset_default_values():
	if score_requirement_reached:
		# Apply time reduction for the next level
		level_time = default_level_time + (level - 1) * 10 - time_reduction_bonus
		score_requirement_reached = false 
	else:
		# Apply time without reduction for the next level
		level_time = default_level_time + (level - 1) * 10
	score_requirement = randi_range(min_score_requirement, max_score_requirement)
	score = 0
	jump_boost_count = 0
	lives = 1000  # TEMP: high lives for controls testing
	obstacle_spawn_chance = obstacle_spawn_chance
	advanced_obstacle_spawn_chance = advanced_obstacle_spawn_chance
	# Emit signals to update the game state
	score_updated.emit()
	level_time_updated.emit()
	jump_boost_updated.emit()
	lives_updated.emit()
	level_updated.emit()

# Saving/Loading variables
const SAVE_PATH = "user://dock_roll_save.cfg"
var save_data = ConfigFile.new()

# Save Game Logic
func save_game():
	save_data.clear()  # Clear previous data

	# Store your data under a section and key
	save_data.set_value("game", "score", score)
	save_data.set_value("game", "level_time", level_time)
	save_data.set_value("game", "jump_boost_count", jump_boost_count)
	save_data.set_value("game", "lives", lives)
	save_data.set_value("game", "level", level)
	save_data.set_value("game", "obstacle_spawn_chance", obstacle_spawn_chance)
	save_data.set_value("game", "advanced_obstacle_spawn_chance", advanced_obstacle_spawn_chance)
	save_data.set_value("game", "score_requirement_reached", score_requirement_reached)
	
	# Save game
	var error = save_data.save(SAVE_PATH)
	if error == OK:
		print("Game saved successfully.")
	else:
		print("Failed to save game:", error)

# Load Game Logic
func load_game():
	var error = save_data.load(SAVE_PATH)
	if error == OK:
		score = save_data.get_value("game", "score", 0)
		level_time = save_data.get_value("game", "level_time", default_level_time)
		jump_boost_count = save_data.get_value("game", "jump_boost_count", 0)
		lives = save_data.get_value("game", "lives", 3)
		level = save_data.get_value("game", "level", 1)
		obstacle_spawn_chance = save_data.get_value("game", "obstacle_spawn_chance", 0.5)
		advanced_obstacle_spawn_chance = save_data.get_value("game", "advanced_obstacle_spawn_chance", 0)
		score_requirement_reached = save_data.get_value("game", "score_requirement_reached", false)

		# Emit signals to update HUD and other game elements
		score_updated.emit()
		level_time_updated.emit()
		jump_boost_updated.emit()
		lives_updated.emit()
		level_updated.emit()
		update_results.emit()
		
		print("Game loaded successfully.")
	else:
		print("Failed to load game:", error)

# ══════════════════════════════════════════════════════════════════════
#  Artikel Runner: word queue + JS bridge
# ══════════════════════════════════════════════════════════════════════

func load_words_from_js():
	if not OS.has_feature("web"):
		return
	# Check both the iframe's own window AND the parent window (React app)
	var raw = JavaScriptBridge.eval("""
		(function() {
			try {
				if (window.parent && window.parent !== window && window.parent._artikelRunnerWords) {
					return JSON.stringify(window.parent._artikelRunnerWords);
				}
			} catch(e) {}
			try {
				if (window._artikelRunnerWords) {
					return JSON.stringify(window._artikelRunnerWords);
				}
			} catch(e) {}
			return "";
		})()
	""")
	if raw is String and raw != "":
		var parsed = JSON.parse_string(raw)
		if parsed is Array and parsed.size() > 0:
			word_queue = parsed

func init_word_queue():
	load_words_from_js()
	if word_queue.is_empty():
		word_queue = DEFAULT_WORDS.duplicate()
	word_queue.shuffle()
	word_idx = 0
	correct_count = 0
	wrong_count = 0
	session_results = []
	next_word()

func next_word():
	if word_idx >= word_queue.size():
		word_queue.shuffle()
		word_idx = 0
	current_word = word_queue[word_idx]
	word_idx += 1
	current_word_updated.emit()

func record_article_answer(picked_article: String):
	var correct: bool = picked_article == String(current_word.get("article", ""))
	if correct:
		correct_count += 1
		score += 1
		score_updated.emit()
	else:
		wrong_count += 1
		if lives > 0:
			lives -= 1
			lives_updated.emit()
	session_results.append({
		"noun": current_word.get("noun", ""),
		"correct_article": current_word.get("article", ""),
		"picked_article": picked_article,
		"correct": correct,
	})
	next_word()

func send_results_to_js():
	if not OS.has_feature("web"):
		return
	var data := {
		"type": "game_over",
		"score": score,
		"correct": correct_count,
		"wrong": wrong_count,
		"results": session_results,
	}
	JavaScriptBridge.eval(
		"window.parent.postMessage(%s, '*')" % JSON.stringify(data)
	)
