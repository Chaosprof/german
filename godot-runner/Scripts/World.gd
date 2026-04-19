### World.gd

extends StaticBody3D

# Node reference
@onready var platforms = $Platforms
@onready var obstacles = $Obstacles
@onready var environment = $Environment
@onready var collectibles = $Collectibles

# Platform vars
var last_platform_position = Vector3()
var last_air_platform_position = Vector3()
var platform_length = 4
var initial_platform_count = 8
var cleanup_object_count = 8
var player

# Environmental variables — German city layout (tight framing like Subway Surfers)
const min_platform_distance = 3.2
const max_platform_distance = 5.5
const left_side = -1
const right_side = 1
const building_position = -1.0
const ground_position = -1
const sidewalk_position = -1.0

func _ready():
	initialize_game_elements()
	
# Initial game state when level loads
func initialize_game_elements():
	player = get_node_or_null("/root/Main/Player") 
	player.position = Vector3(0, 0, 0)
	last_air_platform_position = Vector3(0, 0, 5)
	# Spawn the initial objects
	for i in range(initial_platform_count):
		spawn_platform_segment()
		spawn_air_platform_segments()
		spawn_obstacle()
		spawn_environmental_segment(last_platform_position.z)
		spawn_sidewalk(i * platform_length, sidewalk_position)
	
# Spawn and cleanup objects
func _on_timer_timeout():
	var player_position = player.global_transform.origin
	# Check if the player is moving by verifying the velocity on the X or Z axis
	if player.velocity.length() > 0 and player_position.z <= last_platform_position.z - initial_platform_count:
		spawn_platform_segment()
		spawn_air_platform_segments()
		spawn_obstacle()
		spawn_environmental_segment(last_platform_position.z)
	cleanup_old_objects()
	
# Spawn platforms
func spawn_platform_segment():
	# Randomly select a platform resource
	var platform_resource = Global.platform_resources[randi() % Global.platform_resources.size()]
	var new_platform = platform_resource.instantiate()
	new_platform.transform.origin = last_platform_position
	platforms.add_child(new_platform)
	# Update the position for the next path segment
	last_platform_position += Vector3(0, 0, platform_length)
	# Spawn collectible on platform
	if new_platform:
		call_deferred("spawn_collectible", new_platform)
	
# Spawn air platforms
func spawn_air_platform_segments():
	# Decide randomly whether to spawn an in-air platform or a series of platforms
	if randf() < Global.air_platform_spawn_chance:
		# Decide the number of platforms to form a path in the air
		var number_of_in_air_platforms = randi_range(3, 5)  
		var y_position = 1.5 # Height above the ground platforms
		# Choose a random X position for the entire sequence
		var x_position = randi_range(-1, 1) 
		for i in range(number_of_in_air_platforms):
			var platform_resource = Global.air_platforms_resources[randi() % Global.air_platforms_resources.size()]
			var new_platform = platform_resource.instantiate()
			var z_position = last_air_platform_position.z + i
			new_platform.transform.origin = Vector3(x_position, y_position, z_position)
			platforms.add_child(new_platform)
			# Don't spawn article coins on air platforms — the platform is only in
			# one lane, so the 3-lane coin row would push coins off the track.
		# Update the position to be after the last spawned in-air platform
		last_air_platform_position.z += platform_length * number_of_in_air_platforms
	
# Spawn Obstacles
func spawn_obstacle():
	# Obstacles sit on one of the 3 lanes (x = -1, 0, 1) so they line up with
	# the player's discrete lane positions. Cap at 2 per row so at least one
	# lane is always clear.
	var possible_x_positions := [-1, 0, 1]
	possible_x_positions.shuffle()
	var obstacles_in_row: int = randi() % 2 + 1  # 1 or 2
	if randf() < Global.obstacle_spawn_chance:
		for i in range(obstacles_in_row):
			var obstacle_instance = Global.obstacle_scene.instantiate()
			var x_position: int = possible_x_positions[i]
			obstacle_instance.transform.origin = last_platform_position + Vector3(x_position, 0, platform_length)
			obstacles.add_child(obstacle_instance)
	

# Spawn sidewalk/pavement on both sides of the track
func spawn_sidewalk(along_z: float, y_level: float):
	var sidewalk_resource = Global.environment_resources["sidewalk"][0]
	var distance_from_platform = 2.5
	var extent = 2

	for i in range(extent):
		var left = sidewalk_resource.instantiate()
		left.transform.origin = Vector3(-distance_from_platform - (i * platform_length), y_level, along_z)
		environment.add_child(left)

		var right = sidewalk_resource.instantiate()
		right.transform.origin = Vector3(distance_from_platform + (i * platform_length), y_level, along_z)
		environment.add_child(right)

func spawn_ground_and_clouds(asset_category, along_z, y_pos):
	var random_index = randi() % asset_category.size()
	var instance = asset_category[random_index].instantiate()
	var side = left_side if randi() % 2 == 0 else right_side
	var distance_from_platform = randf_range(min_platform_distance, max_platform_distance)
	
	# Set the position
	instance.transform.origin = Vector3(
		side * distance_from_platform,  # X position next to platform
		y_pos,                     # Y position
		along_z                    # Z position along the path
	)
	# Add instance to the environment node
	environment.add_child(instance)
	
func spawn_environmental_segment(along_z: float):
	# Spawn buildings at ground level on the sides of the track
	spawn_ground_and_clouds(
		Global.environment_resources["buildings"],
		along_z,
		building_position
	)
	# Spawn ground details (cobblestone patches)
	spawn_ground_and_clouds(
		Global.environment_resources["ground"],
		along_z,
		ground_position
	)
	# Spawn sidewalk on both sides
	spawn_sidewalk(along_z, sidewalk_position)
	
# Spawn Collectibles — Artikel Runner: spawn 3 article coins per platform
# One per lane (x=-1, 0, 1), labeled der / die / das.
var platforms_with_coins := 0
const COIN_SPAWN_EVERY := 2  # spawn a coin row every N platforms

func spawn_collectible(platform_instance):
	platforms_with_coins += 1
	if platforms_with_coins % COIN_SPAWN_EVERY != 0:
		return

	# Low enough that the player's capsule overlaps without needing to jump.
	var base_pos: Vector3 = platform_instance.global_transform.origin + Vector3(0, 0.9, 0)
	var lanes := [-1.0, 0.0, 1.0]
	# Create a row container so the 3 coins can be despawned together.
	# Use to_local so this works even if `collectibles` isn't at world origin.
	var row := Node3D.new()
	row.name = "CoinRow"
	collectibles.add_child(row)
	row.transform.origin = collectibles.to_local(base_pos)
	for i in range(3):
		var article: String = Global.ARTICLES[i]
		var coin_instance = Global.collectible_scene.instantiate()
		coin_instance.set_collectible_type(article)
		# Fixed lane offset relative to the row. No obstacle-lift logic —
		# obstacles spawn on platform N+2, coins on platform N, so they don't overlap.
		coin_instance.transform.origin = Vector3(lanes[i], 0, 0)
		row.add_child(coin_instance)
			
# Cleans up platforms & objects behind player
func cleanup_old_objects():
	# Remove platforms
	for platform in platforms.get_children():
		if platform.global_transform.origin.z < player.global_transform.origin.z - cleanup_object_count:
			platform.queue_free() # Remove the platform from the scene

	# Remove obstacles
	for obstacle in obstacles.get_children():
		if obstacle.global_transform.origin.z < player.global_transform.origin.z - cleanup_object_count:
			obstacle.queue_free() # Remove the obstacle from the scene

	# Remove environmentals
	for element in environment.get_children():
		if element.global_transform.origin.z < player.global_transform.origin.z - cleanup_object_count:
			element.queue_free()
			
	# Remove collectibles
	for collectible in collectibles.get_children():
		if collectible.global_transform.origin.z < player.global_transform.origin.z - cleanup_object_count:
			collectible.queue_free()

# Reset World State
func reset_world():
	reset_objects()
	initialize_game_elements()

func reset_objects():
	# Reset platform positions
	last_platform_position = Vector3.ZERO  
	last_air_platform_position = Vector3.ZERO 
	
	# Remove all platforms
	for platform in platforms.get_children():
		platform.queue_free()

	# Remove all obstacles
	for obstacle in obstacles.get_children():
		obstacle.queue_free()

	# Remove all environment objects
	for object in environment.get_children():
		object.queue_free()

	# Remove all collectibles
	for collectible in collectibles.get_children():
		collectible.queue_free()
