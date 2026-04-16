### Player.gd — Artikel Runner

extends CharacterBody3D

# Animation State booleans
var is_jumping = false
var game_starts = false
var game_won = false
var _results_sent = false

# Movement variables
var speed = 5.0
var jump_velocity = 10.0
const jump_speed = 3.0
const gravity = 20

# Lane-based horizontal movement (3 lanes)
const LANE_POSITIONS := [-1.0, 0.0, 1.0]  # world X for lanes; matches obstacle/coin spawns
const LANE_SNAP_SPEED := 16.0             # how fast the player slides between lanes
var current_lane: int = 1                 # 0=world-X-neg, 1=middle, 2=world-X-pos

# Node refs
@onready var game_timer = $GameTimer
@onready var game_over_screen = $HUD/GameOverScreen
@onready var game_results_label = $HUD/GameOverScreen/Container/Results/Label
@onready var progress_button = $HUD/GameOverScreen/Container/Results/ProgressButton
@onready var world = get_node("/root/Main/World")
@onready var main = get_node("/root/Main/")
@onready var start_screen = $HUD/StartScreen
@onready var level_pass_music = $Sounds/LevelPassMusic
@onready var level_fail_music = $Sounds/LevelFailMusic
@onready var jump_sfx = $Sounds/JumpSFX

# Game State
enum game_state {CONTINUE, RETRY}
var current_state

func _ready():
	# Auto-start: don't show start screen on web
	start_screen.visible = false
	game_starts = true
	Global.game_started = true
	game_timer.start()
	Global.score_requirement = 999  # effectively disabled for endless practice

func _physics_process(delta):
	handle_movement(delta)

func handle_movement(delta):
	if game_starts and not game_won:
		# Discrete lane switching. Camera is rotated 180° around Y, so screen-right
		# corresponds to world -X; pressing "ui_right" should decrement current_lane
		# (which maps to a smaller world X).
		if Input.is_action_just_pressed("ui_right"):
			current_lane = max(0, current_lane - 1)
		if Input.is_action_just_pressed("ui_left"):
			current_lane = min(LANE_POSITIONS.size() - 1, current_lane + 1)
		# Slide toward target lane
		var target_x: float = LANE_POSITIONS[current_lane]
		velocity.x = (target_x - position.x) * LANE_SNAP_SPEED

		# Handle vertical movement (jumping)
		if is_on_floor():
			if Input.is_action_just_pressed("ui_jump"):
				jump_velocity = 10
				velocity.y = jump_velocity
				is_jumping = true
				if jump_sfx:
					jump_sfx.play()
			else:
				is_jumping = false
		else:
			velocity.y -= gravity * delta

		# Adjust forward movement if jumping
		velocity.z = jump_speed if is_jumping else speed

		# Move the character
		move_and_slide()

		# Check for air platform collision
		if velocity.z == 0:
			check_for_platform_collisions()

# Air Platform Collisions
func check_for_platform_collisions():
	for i in range(get_slide_collision_count()):
		var collision = get_slide_collision(i)
		var collider = collision.get_collider()
		if collider and collider.is_in_group("Air_Platform"):
			if collision.get_normal().dot(Vector3(0, 0, -1)) > 0.5:
				# TEMP: softened for controls testing — deduct 1 life instead of instant game over
				if Global.lives > 0:
					Global.lives -= 1
					Global.lives_updated.emit()
				break

# Input handled for retry on game over
func _input(event):
	if game_over_screen and game_over_screen.visible:
		if event is InputEventKey and event.pressed:
			_send_results_and_exit()
		elif event is InputEventScreenTouch and event.pressed:
			_send_results_and_exit()

# Game timer
func _on_game_timer_timeout():
	Global.level_time -= 1
	Global.level_time_updated.emit()
	if Global.level_time <= 0 or Global.lives == 0:
		game_over()

# Player effects (unused in Artikel Runner; article coins go through Global.record_article_answer)
func apply_effect(effect_name):
	match effect_name:
		"increase_score":
			Global.score += 1
			Global.score_updated.emit()
		"boost_jump":
			Global.jump_boost_count += 1
			Global.jump_boost_updated.emit()
		"decrease_time":
			if Global.level_time >= 10:
				Global.level_time -= 10
				Global.level_time_updated.emit()

# Level Progression
func game_over():
	game_timer.stop()
	game_starts = false
	Global.game_started = false
	if main.level_music:
		main.level_music.stop()
	game_over_screen.visible = true
	if Global.lives <= 0:
		game_won = false
		game_results_label.text = "GAME OVER"
		if progress_button: progress_button.text = "EXIT"
		current_state = game_state.RETRY
		if level_fail_music: level_fail_music.play()
	else:
		game_won = true
		game_results_label.text = "TIME UP!"
		if progress_button: progress_button.text = "EXIT"
		current_state = game_state.CONTINUE
		if level_pass_music: level_pass_music.play()
	Global.update_results.emit()
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	# Send results back to the React app
	_send_results()

func _send_results():
	if _results_sent:
		return
	_results_sent = true
	Global.send_results_to_js()

func _send_results_and_exit():
	_send_results()

# Reset Game State (kept for compatibility — unused on web)
func reset_game_state():
	is_jumping = false
	game_starts = false
	Global.game_started = false
	game_won = false
	game_over_screen.visible = false
	world.reset_world()
	get_tree().paused = false
	start_screen.visible = false
	if main.level_music: main.level_music.play()

# Progress/Retry button (unused on web but connected via signal)
func _on_progress_button_pressed():
	_send_results_and_exit()
