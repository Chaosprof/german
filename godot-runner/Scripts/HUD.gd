### HUD.gd — Artikel Runner interface, built entirely in code.
### Big word prompt, score/coins/hearts, streak chip, feedback toasts,
### countdown intro and game-over panel with retry.

extends CanvasLayer

signal retry_requested
signal exit_requested

const FONT_PATH := "res://Assets/Fonts/droid-sans/DroidSans-Bold.ttf"
const HEART_FULL := "res://Assets/Icons/HeartFull.png"
const COIN_ICON := "res://Assets/Icons/Coin.png"

var _font: FontFile
var _prompt: Label
var _prompt_panel: PanelContainer
var _score: Label
var _best: Label
var _coins_lbl: Label
var _hearts: Array = []
var _streak_chip: PanelContainer
var _streak_lbl: Label
var _toast: Label
var _float_pts: Label
var _panel: Control
var _countdown: Label

func _ready() -> void:
	_font = load(FONT_PATH)
	_build_prompt()
	_build_topleft()
	_build_topright()
	_build_toast()
	_build_countdown()
	_build_gameover()
	Global.score_updated.connect(_update_score)
	Global.coins_updated.connect(_update_coins)
	Global.hearts_updated.connect(_update_hearts)
	Global.streak_updated.connect(_update_streak)
	Global.word_updated.connect(_update_word)
	Global.answer_feedback.connect(_on_feedback)
	Global.game_ended.connect(_on_game_ended)
	_update_score()
	_update_coins()
	_update_hearts()
	_update_streak()
	_update_word()

func _lbl(size: int, color := Color.WHITE, outline := 8) -> Label:
	var l := Label.new()
	l.add_theme_font_override("font", _font)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color(0.07, 0.09, 0.16, 0.9))
	l.add_theme_constant_override("outline_size", outline)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return l

func _style(bg: Color, radius := 14, border := Color.TRANSPARENT) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.corner_radius_top_left = radius
	sb.corner_radius_top_right = radius
	sb.corner_radius_bottom_left = radius
	sb.corner_radius_bottom_right = radius
	sb.content_margin_left = 18
	sb.content_margin_right = 18
	sb.content_margin_top = 8
	sb.content_margin_bottom = 8
	if border.a > 0:
		sb.border_color = border
		sb.set_border_width_all(3)
	return sb

# ── Word prompt (top centre) ─────────────────────────────────────────
func _build_prompt() -> void:
	_prompt_panel = PanelContainer.new()
	_prompt_panel.add_theme_stylebox_override("panel", _style(Color(0.07, 0.09, 0.16, 0.72), 18))
	_prompt_panel.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_prompt_panel.position = Vector2(0, 14)
	_prompt_panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	add_child(_prompt_panel)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 0)
	_prompt_panel.add_child(vb)
	_prompt = _lbl(52)
	_prompt.text = "___  Wort"
	vb.add_child(_prompt)
	var hint := _lbl(17, Color(0.78, 0.82, 0.95))
	hint.text = "Lauf durch das richtige Tor!"
	hint.name = "Hint"
	vb.add_child(hint)
	# Streak chip below
	_streak_chip = PanelContainer.new()
	_streak_chip.add_theme_stylebox_override("panel", _style(Color(0.98, 0.65, 0.10, 0.95), 12))
	_streak_chip.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_streak_chip.position = Vector2(0, 116)
	_streak_chip.visible = false
	add_child(_streak_chip)
	_streak_lbl = _lbl(22, Color(0.12, 0.07, 0.02), 0)
	_streak_chip.add_child(_streak_lbl)

func _update_word() -> void:
	var noun: String = Global.current_word.get("noun", "")
	_prompt.text = "___  " + noun if noun != "" else "…"
	var tw := create_tween()
	_prompt_panel.scale = Vector2(1.12, 1.12)
	_prompt_panel.pivot_offset = _prompt_panel.size * 0.5
	tw.tween_property(_prompt_panel, "scale", Vector2.ONE, 0.22).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

func _update_streak() -> void:
	var s: int = Global.streak
	_streak_chip.visible = s >= 2
	if s >= 2:
		_streak_lbl.text = "%d in Folge!  ×%d" % [s, Global.multiplier()]
		var tw := create_tween()
		_streak_chip.scale = Vector2(1.25, 1.25)
		_streak_chip.pivot_offset = _streak_chip.size * 0.5
		tw.tween_property(_streak_chip, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

# ── Top-left: hearts ─────────────────────────────────────────────────
func _build_topleft() -> void:
	var hb := HBoxContainer.new()
	hb.position = Vector2(16, 14)
	hb.add_theme_constant_override("separation", 6)
	add_child(hb)
	for i in 3:
		var tr := TextureRect.new()
		tr.texture = load(HEART_FULL)
		tr.custom_minimum_size = Vector2(44, 44)
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		hb.add_child(tr)
		_hearts.append(tr)

func _update_hearts() -> void:
	for i in 3:
		var tr: TextureRect = _hearts[i]
		var has := i < Global.hearts
		var target: Color = Color.WHITE if has else Color(0.25, 0.25, 0.3, 0.5)
		if tr.modulate != target and not has:
			var tw := create_tween()
			tw.tween_property(tr, "scale", Vector2(1.5, 1.5), 0.12)
			tw.tween_property(tr, "scale", Vector2.ONE, 0.18)
		tr.pivot_offset = Vector2(22, 22)
		tr.modulate = target

# ── Top-right: score / coins ─────────────────────────────────────────
func _build_topright() -> void:
	var vb := VBoxContainer.new()
	vb.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	vb.position = Vector2(-16, 12)
	vb.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	vb.add_theme_constant_override("separation", 2)
	add_child(vb)
	_score = _lbl(40)
	_score.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_score.text = "0"
	vb.add_child(_score)
	_best = _lbl(16, Color(0.80, 0.84, 0.95))
	_best.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	vb.add_child(_best)
	var hb := HBoxContainer.new()
	hb.alignment = BoxContainer.ALIGNMENT_END
	hb.add_theme_constant_override("separation", 6)
	vb.add_child(hb)
	var ci := TextureRect.new()
	ci.texture = load(COIN_ICON)
	ci.custom_minimum_size = Vector2(30, 30)
	ci.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ci.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	hb.add_child(ci)
	_coins_lbl = _lbl(26, Color(1.0, 0.85, 0.3))
	_coins_lbl.text = "0"
	hb.add_child(_coins_lbl)
	# floating points label (reused)
	_float_pts = _lbl(30, Color(0.4, 1.0, 0.55))
	_float_pts.visible = false
	add_child(_float_pts)

func _update_score() -> void:
	_score.text = str(Global.score)
	_best.text = "BEST %d" % maxi(Global.high_score, Global.score)

func _update_coins() -> void:
	_coins_lbl.text = str(Global.coins)
	var tw := create_tween()
	_coins_lbl.pivot_offset = _coins_lbl.size * 0.5
	_coins_lbl.scale = Vector2(1.3, 1.3)
	tw.tween_property(_coins_lbl, "scale", Vector2.ONE, 0.15)

# ── Feedback toast ───────────────────────────────────────────────────
func _build_toast() -> void:
	_toast = _lbl(46)
	_toast.set_anchors_preset(Control.PRESET_CENTER)
	_toast.position = Vector2(0, -60)
	_toast.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_toast.visible = false
	add_child(_toast)

func _on_feedback(correct: bool, word: Dictionary, _picked: String) -> void:
	var noun: String = word.get("noun", "")
	var article: String = word.get("article", "")
	if correct:
		_toast.text = "✓  %s %s" % [article, noun]
		_toast.add_theme_color_override("font_color", Color(0.35, 1.0, 0.55))
		_show_float_pts("+%d" % (100 * Global.multiplier()))
	else:
		_toast.text = "✗  %s %s!" % [article, noun]
		_toast.add_theme_color_override("font_color", Color(1.0, 0.30, 0.28))
	_toast.visible = true
	_toast.pivot_offset = _toast.size * 0.5
	_toast.scale = Vector2(0.4, 0.4)
	_toast.modulate.a = 1.0
	var tw := create_tween()
	tw.tween_property(_toast, "scale", Vector2.ONE, 0.18).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_interval(0.85)
	tw.tween_property(_toast, "modulate:a", 0.0, 0.3)
	tw.tween_callback(func(): _toast.visible = false)

func _show_float_pts(txt: String) -> void:
	_float_pts.text = txt
	_float_pts.visible = true
	_float_pts.modulate.a = 1.0
	var vp_size: Vector2 = get_viewport().get_visible_rect().size
	_float_pts.position = Vector2(vp_size.x * 0.5 - 40, vp_size.y * 0.34)
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(_float_pts, "position:y", _float_pts.position.y - 70, 0.8)
	tw.tween_property(_float_pts, "modulate:a", 0.0, 0.8).set_delay(0.2)
	tw.chain().tween_callback(func(): _float_pts.visible = false)

# ── Countdown intro ──────────────────────────────────────────────────
func _build_countdown() -> void:
	_countdown = _lbl(120)
	_countdown.set_anchors_preset(Control.PRESET_CENTER)
	_countdown.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_countdown.grow_vertical = Control.GROW_DIRECTION_BOTH
	_countdown.visible = false
	add_child(_countdown)

func play_countdown() -> void:
	_countdown.visible = true
	var seq := ["3", "2", "1", "LOS!"]
	var tw := create_tween()
	for s in seq:
		tw.tween_callback(func():
			_countdown.text = s
			_countdown.pivot_offset = _countdown.size * 0.5
			_countdown.scale = Vector2(1.6, 1.6)
			_countdown.modulate.a = 1.0
		)
		tw.tween_property(_countdown, "scale", Vector2.ONE, 0.30).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		tw.tween_interval(0.12)
	tw.tween_property(_countdown, "modulate:a", 0.0, 0.25)
	tw.tween_callback(func(): _countdown.visible = false)

# ── Game-over panel ──────────────────────────────────────────────────
func _build_gameover() -> void:
	_panel = Control.new()
	_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	_panel.visible = false
	add_child(_panel)
	var dim := ColorRect.new()
	dim.color = Color(0.04, 0.05, 0.10, 0.72)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	_panel.add_child(dim)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	_panel.add_child(center)
	var card := PanelContainer.new()
	card.name = "Card"
	card.add_theme_stylebox_override("panel", _style(Color(0.10, 0.12, 0.22, 0.97), 22, Color(0.45, 0.40, 0.95)))
	center.add_child(card)
	var vb := VBoxContainer.new()
	vb.name = "VB"
	vb.add_theme_constant_override("separation", 10)
	vb.custom_minimum_size = Vector2(420, 0)
	card.add_child(vb)
	var title := _lbl(44)
	title.name = "Title"
	vb.add_child(title)
	var grid := GridContainer.new()
	grid.name = "Stats"
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 36)
	grid.add_theme_constant_override("v_separation", 4)
	vb.add_child(grid)
	var btns := HBoxContainer.new()
	btns.alignment = BoxContainer.ALIGNMENT_CENTER
	btns.add_theme_constant_override("separation", 18)
	vb.add_child(btns)
	btns.add_child(_button("NOCHMAL", Color(0.30, 0.75, 0.35), func(): retry_requested.emit()))
	btns.add_child(_button("FERTIG", Color(0.35, 0.40, 0.65), func(): exit_requested.emit()))

func _button(text: String, color: Color, cb: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.add_theme_font_override("font", _font)
	b.add_theme_font_size_override("font_size", 26)
	b.add_theme_color_override("font_color", Color.WHITE)
	b.add_theme_color_override("font_hover_color", Color.WHITE)
	b.add_theme_color_override("font_pressed_color", Color(0.9, 0.9, 0.9))
	b.add_theme_stylebox_override("normal", _style(color, 14))
	var hover_c := color.lightened(0.15)
	b.add_theme_stylebox_override("hover", _style(hover_c, 14))
	b.add_theme_stylebox_override("pressed", _style(color.darkened(0.15), 14))
	b.custom_minimum_size = Vector2(170, 56)
	b.pressed.connect(cb)
	return b

func _stat_row(grid: GridContainer, label: String, value: String, hl := false) -> void:
	var l := _lbl(20, Color(0.75, 0.79, 0.92), 0)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	l.text = label
	grid.add_child(l)
	var v := _lbl(20, Color(1.0, 0.9, 0.4) if hl else Color.WHITE, 0)
	v.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.text = value
	grid.add_child(v)

func _on_game_ended(_won: bool) -> void:
	var card: PanelContainer = _panel.get_node("CenterContainer/Card") if _panel.has_node("CenterContainer/Card") else null
	var vb: VBoxContainer = _panel.find_child("VB", true, false)
	var title: Label = _panel.find_child("Title", true, false)
	var grid: GridContainer = _panel.find_child("Stats", true, false)
	for c in grid.get_children():
		c.queue_free()
	var total: int = Global.correct_count + Global.wrong_count
	var acc: int = int(round(100.0 * Global.correct_count / maxf(total, 1)))
	var new_best: bool = Global.score >= Global.high_score and Global.score > 0
	title.text = "NEUER REKORD!" if new_best else "GAME OVER"
	title.add_theme_color_override("font_color", Color(1.0, 0.85, 0.25) if new_best else Color.WHITE)
	_stat_row(grid, "Punkte", str(Global.score), new_best)
	_stat_row(grid, "Rekord", str(Global.high_score))
	_stat_row(grid, "Strecke", "%d m" % int(Global.distance))
	_stat_row(grid, "Münzen", str(Global.coins))
	_stat_row(grid, "Richtig", "%d / %d  (%d%%)" % [Global.correct_count, total, acc])
	_stat_row(grid, "Beste Serie", str(Global.best_streak))
	_panel.visible = true
	_panel.modulate.a = 0.0
	var tw := create_tween()
	tw.tween_property(_panel, "modulate:a", 1.0, 0.3)
	# The run is over — the prompt would just be noise behind the card
	_prompt_panel.visible = false
	_streak_chip.visible = false
	_toast.visible = false

func hide_gameover() -> void:
	_panel.visible = false
	_prompt_panel.visible = true
