### Global.gd — Artikel Runner game state (autoload)
### Keeps the JS bridge contract:
###   in:  window.parent._artikelRunnerWords = [{noun, article}, ...]
###   out: window.parent.postMessage({type:"game_over", score, correct, wrong, results}, "*")

extends Node

const ARTICLES := ["der", "die", "das"]

var DEFAULT_WORDS := [
	{"noun": "Hund", "article": "der"}, {"noun": "Katze", "article": "die"},
	{"noun": "Buch", "article": "das"}, {"noun": "Tisch", "article": "der"},
	{"noun": "Lampe", "article": "die"}, {"noun": "Auto", "article": "das"},
	{"noun": "Stuhl", "article": "der"}, {"noun": "Blume", "article": "die"},
	{"noun": "Fenster", "article": "das"}, {"noun": "Baum", "article": "der"},
	{"noun": "Sonne", "article": "die"}, {"noun": "Kind", "article": "das"},
	{"noun": "Berg", "article": "der"}, {"noun": "Straße", "article": "die"},
	{"noun": "Wasser", "article": "das"}, {"noun": "Apfel", "article": "der"},
	{"noun": "Milch", "article": "die"}, {"noun": "Brot", "article": "das"},
	{"noun": "Schuh", "article": "der"}, {"noun": "Uhr", "article": "die"},
	{"noun": "Geld", "article": "das"}, {"noun": "Fisch", "article": "der"},
	{"noun": "Tür", "article": "die"}, {"noun": "Bier", "article": "das"},
	{"noun": "Mond", "article": "der"}, {"noun": "Nacht", "article": "die"},
	{"noun": "Herz", "article": "das"}, {"noun": "Vogel", "article": "der"},
	{"noun": "Stadt", "article": "die"}, {"noun": "Mädchen", "article": "das"},
]

# ── Run state ────────────────────────────────────────────────────────
var running := false
var score: int = 0
var coins: int = 0
var hearts: int = 3
var streak: int = 0
var best_streak: int = 0
var distance: float = 0.0
var correct_count: int = 0
var wrong_count: int = 0
var session_results: Array = []
var high_score: int = 0

# Word queue
var word_queue: Array = []
var word_idx: int = 0
var current_word: Dictionary = {"noun": "", "article": "der"}

# Mastery / outfits (persisted)
var mastered_nouns: Dictionary = {}
var total_mastered: int = 0
const OUTFIT_TIERS := {0: "default", 50: "berlin", 100: "bayern", 200: "hamburg"}
var current_outfit: String = "default"

# ── Signals ──────────────────────────────────────────────────────────
signal score_updated
signal coins_updated
signal hearts_updated
signal streak_updated
signal word_updated
signal answer_feedback(correct: bool, word: Dictionary, picked: String)
signal crashed
signal game_ended(won: bool)
signal outfit_changed

func multiplier() -> int:
	return clampi(1 + streak / 3, 1, 5)

# ── Run lifecycle ────────────────────────────────────────────────────
func reset_run() -> void:
	running = true
	score = 0
	coins = 0
	hearts = 3
	streak = 0
	best_streak = 0
	distance = 0.0
	correct_count = 0
	wrong_count = 0
	session_results = []
	if word_queue.is_empty():
		init_word_queue()
	score_updated.emit()
	coins_updated.emit()
	hearts_updated.emit()
	streak_updated.emit()

func add_distance(d: float) -> void:
	if not running:
		return
	distance += d
	var pts := int(distance) - int(distance - d)
	if pts > 0:
		score += pts
		score_updated.emit()

func add_coin() -> void:
	coins += 1
	score += 5
	coins_updated.emit()
	score_updated.emit()

# ── Words ────────────────────────────────────────────────────────────
func load_words_from_js() -> void:
	if not OS.has_feature("web"):
		return
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

func init_word_queue() -> void:
	word_queue = []
	load_words_from_js()
	if word_queue.is_empty():
		word_queue = DEFAULT_WORDS.duplicate()
	word_queue.shuffle()
	word_idx = 0

func take_next_word() -> Dictionary:
	if word_queue.is_empty():
		init_word_queue()
	if word_idx >= word_queue.size():
		word_queue.shuffle()
		word_idx = 0
	var w: Dictionary = word_queue[word_idx]
	word_idx += 1
	return w

func set_active_word(w: Dictionary) -> void:
	current_word = w
	word_updated.emit()

# ── Answers / damage ─────────────────────────────────────────────────
func record_answer(word: Dictionary, picked: String) -> bool:
	var correct: bool = picked == String(word.get("article", ""))
	if correct:
		correct_count += 1
		streak += 1
		best_streak = maxi(best_streak, streak)
		score += 100 * multiplier()
		_track_mastery(String(word.get("noun", "")))
	else:
		wrong_count += 1
		streak = 0
		_lose_heart()
	session_results.append({
		"noun": word.get("noun", ""),
		"correct_article": word.get("article", ""),
		"picked_article": picked,
		"correct": correct,
	})
	score_updated.emit()
	streak_updated.emit()
	answer_feedback.emit(correct, word, picked)
	return correct

func register_crash() -> void:
	if not running:
		return
	streak = 0
	streak_updated.emit()
	_lose_heart()
	crashed.emit()

func _lose_heart() -> void:
	hearts -= 1
	hearts_updated.emit()
	if hearts <= 0 and running:
		end_game(false)

func end_game(won: bool) -> void:
	if not running:
		return
	running = false
	high_score = maxi(high_score, score)
	save_game()
	game_ended.emit(won)
	send_results_to_js()

# ── Mastery / outfits ────────────────────────────────────────────────
func _track_mastery(noun: String) -> void:
	if noun == "":
		return
	if not mastered_nouns.has(noun):
		mastered_nouns[noun] = 0
	mastered_nouns[noun] += 1
	if mastered_nouns[noun] == 3:
		total_mastered += 1
		_check_outfit_unlock()

func _check_outfit_unlock() -> void:
	var best := "default"
	for threshold in OUTFIT_TIERS:
		if total_mastered >= threshold:
			best = OUTFIT_TIERS[threshold]
	if best != current_outfit:
		current_outfit = best
		outfit_changed.emit()

# ── Persistence ──────────────────────────────────────────────────────
const SAVE_PATH = "user://artikel_runner_save.cfg"

func save_game() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("game", "high_score", high_score)
	cfg.set_value("game", "total_mastered", total_mastered)
	cfg.set_value("game", "mastered_nouns", mastered_nouns)
	cfg.set_value("game", "current_outfit", current_outfit)
	cfg.save(SAVE_PATH)

func load_game() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(SAVE_PATH) != OK:
		return
	high_score = cfg.get_value("game", "high_score", 0)
	total_mastered = cfg.get_value("game", "total_mastered", 0)
	var loaded = cfg.get_value("game", "mastered_nouns", {})
	if loaded is Dictionary:
		mastered_nouns = loaded
	current_outfit = cfg.get_value("game", "current_outfit", "default")

func _ready():
	load_game()

# ── JS bridge out ────────────────────────────────────────────────────
func send_results_to_js() -> void:
	if not OS.has_feature("web"):
		return
	var data := {
		"type": "game_over",
		"score": score,
		"correct": correct_count,
		"wrong": wrong_count,
		"results": session_results,
		"coins": coins,
		"distance": int(distance),
		"best_streak": best_streak,
		"high_score": high_score,
	}
	JavaScriptBridge.eval(
		"window.parent.postMessage(%s, '*')" % JSON.stringify(data)
	)
