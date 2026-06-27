### CityKit.gd — procedural stylised German-city asset factory.
### All meshes are vertex-coloured low-poly (Subway-Surfers look) built with
### SurfaceTool, cached statically, and safe for the Compatibility renderer.

class_name CityKit

# ── Palette ──────────────────────────────────────────────────────────
const ROAD := Color(0.32, 0.36, 0.43)
const ROAD_EDGE := Color(0.28, 0.31, 0.37)
const RAIL := Color(0.78, 0.81, 0.86)
const RAIL_BED := Color(0.26, 0.29, 0.34)
const SIDEWALK := Color(0.80, 0.76, 0.70)
const CURB := Color(0.88, 0.85, 0.79)
const PAINT := Color(0.93, 0.93, 0.90)
const FACADES: Array[Color] = [
	Color(0.97, 0.78, 0.42),  # warm cream
	Color(0.90, 0.40, 0.25),  # terracotta
	Color(0.45, 0.70, 0.35),  # sage green
	Color(0.30, 0.52, 0.88),  # cornflower blue
	Color(0.93, 0.48, 0.45),  # rose
	Color(0.95, 0.62, 0.18),  # ochre
	Color(0.30, 0.72, 0.62),  # teal
	Color(0.97, 0.83, 0.30),  # butter yellow
]
const WINDOW_GLASS := Color(0.45, 0.62, 0.82)
const WINDOW_GLASS_LIT := Color(0.99, 0.86, 0.55)
const WINDOW_FRAME := Color(0.97, 0.97, 0.94)
const ROOF_TILE := Color(0.76, 0.38, 0.30)
const ROOF_SLATE := Color(0.38, 0.42, 0.50)
const TIMBER := Color(0.32, 0.22, 0.15)
const TRUNK := Color(0.45, 0.32, 0.22)
const FOLIAGE: Array[Color] = [
	Color(0.24, 0.56, 0.22), Color(0.19, 0.48, 0.18), Color(0.30, 0.64, 0.24)
]
const BARRIER_RED := Color(0.88, 0.20, 0.18)
const BARRIER_WHITE := Color(0.96, 0.96, 0.94)
const METAL_DARK := Color(0.30, 0.33, 0.38)
const BIN_ORANGE := Color(0.95, 0.46, 0.12)
const TRAM_YELLOW := Color(0.99, 0.78, 0.12)
const TRAM_ROOF := Color(0.85, 0.86, 0.88)
const COIN_GOLD := Color(1.0, 0.82, 0.22)
const ARTICLE_COLORS := {
	"der": Color(0.25, 0.55, 1.0),
	"die": Color(1.0, 0.30, 0.45),
	"das": Color(0.20, 0.85, 0.45),
}

const LANE_X: Array[float] = [-2.0, 0.0, 2.0]
const ROAD_HALF := 3.6           # half width of the asphalt
const WALK_W := 3.4              # sidewalk width each side
const CHUNK := 12.0              # chunk length in metres

# ── Shared materials (static cache) ──────────────────────────────────
static var _mats: Dictionary = {}

static func mat_flat() -> StandardMaterial3D:
	if not _mats.has("flat"):
		var m := StandardMaterial3D.new()
		m.vertex_color_use_as_albedo = true
		m.roughness = 0.95
		_mats["flat"] = m
	return _mats["flat"]

static func mat_shiny() -> StandardMaterial3D:
	if not _mats.has("shiny"):
		var m := StandardMaterial3D.new()
		m.vertex_color_use_as_albedo = true
		m.metallic = 0.75
		m.roughness = 0.22
		_mats["shiny"] = m
	return _mats["shiny"]

static func mat_glass() -> StandardMaterial3D:
	if not _mats.has("glass"):
		var m := StandardMaterial3D.new()
		m.vertex_color_use_as_albedo = true
		m.metallic = 0.35
		m.roughness = 0.08
		_mats["glass"] = m
	return _mats["glass"]

static func mat_glow(color: Color, energy: float = 1.6) -> StandardMaterial3D:
	var key := "glow_%s_%.1f" % [color.to_html(false), energy]
	if not _mats.has(key):
		var m := StandardMaterial3D.new()
		m.albedo_color = color
		m.emission_enabled = true
		m.emission = color
		m.emission_energy_multiplier = energy
		m.roughness = 0.4
		_mats[key] = m
	return _mats[key]

static var _soft_dot: ImageTexture = null

# Radial-gradient dot for particle billboards (soft round puffs, not squares)
static func soft_dot() -> ImageTexture:
	if _soft_dot:
		return _soft_dot
	var size := 64
	var img := Image.create(size, size, false, Image.FORMAT_RGBA8)
	for y in size:
		for x in size:
			var d := Vector2(x - size / 2.0 + 0.5, y - size / 2.0 + 0.5).length() / (size / 2.0)
			var a := pow(clampf(1.0 - d, 0.0, 1.0), 1.8)
			img.set_pixel(x, y, Color(1, 1, 1, a))
	_soft_dot = ImageTexture.create_from_image(img)
	return _soft_dot

static func mat_cloud() -> StandardMaterial3D:
	if not _mats.has("cloud"):
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.albedo_color = Color(1, 1, 1, 0.92)
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_mats["cloud"] = m
	return _mats["cloud"]

# ── SurfaceTool primitives ───────────────────────────────────────────
# Axis-aligned box with baked side shading (fake AO) for depth.
static func box(st: SurfaceTool, c: Vector3, s: Vector3, col: Color, shade := true) -> void:
	box_t(st, Transform3D(Basis.IDENTITY, c), s, col, shade)

# Box under an arbitrary transform (for rotated beams etc.)
static func box_t(st: SurfaceTool, t: Transform3D, s: Vector3, col: Color, shade := true) -> void:
	var h := s * 0.5
	var pts := [
		Vector3(-h.x, -h.y, -h.z), Vector3(h.x, -h.y, -h.z),
		Vector3(h.x, h.y, -h.z), Vector3(-h.x, h.y, -h.z),
		Vector3(-h.x, -h.y, h.z), Vector3(h.x, -h.y, h.z),
		Vector3(h.x, h.y, h.z), Vector3(-h.x, h.y, h.z),
	]
	for i in pts.size():
		pts[i] = t * pts[i]
	var top := col
	var side := col * 0.90 if shade else col
	var side2 := col * 0.82 if shade else col
	var bot := col * 0.70 if shade else col
	side.a = 1.0; side2.a = 1.0; bot.a = 1.0
	# -Z face (front), +Z (back), ±X sides, +Y top, -Y bottom
	_face(st, pts[1], pts[0], pts[3], pts[2], side)
	_face(st, pts[4], pts[5], pts[6], pts[7], side)
	_face(st, pts[0], pts[4], pts[7], pts[3], side2)
	_face(st, pts[5], pts[1], pts[2], pts[6], side2)
	_face(st, pts[3], pts[7], pts[6], pts[2], top)
	_face(st, pts[0], pts[1], pts[5], pts[4], bot)

static func _face(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, d: Vector3, col: Color) -> void:
	var n := (b - a).cross(d - a).normalized()
	st.set_color(col)
	st.set_normal(n)
	st.add_vertex(a); st.add_vertex(b); st.add_vertex(c)
	st.add_vertex(a); st.add_vertex(c); st.add_vertex(d)

# Single quad facing +Z (windows etc.), corners given CCW.
static func quad(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, d: Vector3, col: Color) -> void:
	_face(st, a, b, c, d, col)

static func cylinder(st: SurfaceTool, c: Vector3, r_bot: float, r_top: float, h: float, col: Color, segs := 10, cap := true) -> void:
	var half := h * 0.5
	for i in segs:
		var a0 := TAU * i / segs
		var a1 := TAU * (i + 1) / segs
		var b0 := c + Vector3(cos(a0) * r_bot, -half, sin(a0) * r_bot)
		var b1 := c + Vector3(cos(a1) * r_bot, -half, sin(a1) * r_bot)
		var t0 := c + Vector3(cos(a0) * r_top, half, sin(a0) * r_top)
		var t1 := c + Vector3(cos(a1) * r_top, half, sin(a1) * r_top)
		_face(st, b1, b0, t0, t1, col * 0.92 + Color(0,0,0,1) * 0.08)
		if cap:
			st.set_color(col)
			st.set_normal(Vector3.UP)
			st.add_vertex(c + Vector3(0, half, 0)); st.add_vertex(t1); st.add_vertex(t0)

static func new_st() -> SurfaceTool:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	return st

static func commit(st: SurfaceTool, mat: Material, into: ArrayMesh = null) -> ArrayMesh:
	st.set_material(mat)
	return st.commit(into)

# ══════════════════════════════════════════════════════════════════════
#  GROUND CHUNK — road + tram rails + sidewalks + curbs (one mesh)
# ══════════════════════════════════════════════════════════════════════
static var _ground_mesh: ArrayMesh = null
static var _ground_cross_mesh: ArrayMesh = null

static func ground_chunk(with_crosswalk := false) -> ArrayMesh:
	if with_crosswalk and _ground_cross_mesh:
		return _ground_cross_mesh
	if not with_crosswalk and _ground_mesh:
		return _ground_mesh
	var st := new_st()
	var L := CHUNK
	# Asphalt
	box(st, Vector3(0, -0.10, L * 0.5), Vector3(ROAD_HALF * 2, 0.20, L), ROAD, false)
	# Lane edge strips
	box(st, Vector3(-ROAD_HALF + 0.10, -0.004, L * 0.5), Vector3(0.18, 0.205, L), ROAD_EDGE, false)
	box(st, Vector3(ROAD_HALF - 0.10, -0.004, L * 0.5), Vector3(0.18, 0.205, L), ROAD_EDGE, false)
	# Tram rails in the centre lane (two pairs look = U-shape street)
	for rx in [-0.65, 0.65]:
		box(st, Vector3(rx, 0.002, L * 0.5), Vector3(0.30, 0.012, L), RAIL_BED, false)
	# Cobble strip between rails
	box(st, Vector3(0.0, -0.002, L * 0.5), Vector3(1.0, 0.008, L), ROAD * 1.12, false)
	# Dashed lane separators
	for dx in [-1.0, 1.0]:
		var dz := 0.6
		while dz < L:
			box(st, Vector3(dx, 0.004, dz), Vector3(0.10, 0.012, 1.1), PAINT, false)
			dz += 3.0
	# Sidewalks + curbs
	for side: float in [-1.0, 1.0]:
		var wx: float = side * (ROAD_HALF + WALK_W * 0.5 + 0.25)
		box(st, Vector3(wx, -0.025, L * 0.5), Vector3(WALK_W, 0.35, L), SIDEWALK, false)
		box(st, Vector3(side * (ROAD_HALF + 0.125), -0.02, L * 0.5), Vector3(0.25, 0.36, L), CURB, false)
		# paving joints (subtle darker lines)
		var jz := 0.0
		while jz < L:
			box(st, Vector3(wx, 0.152, jz), Vector3(WALK_W, 0.012, 0.07), SIDEWALK * 0.92, false)
			jz += 2.0
	if with_crosswalk:
		# Zebra stripes across the road
		var x := -ROAD_HALF + 0.55
		while x < ROAD_HALF - 0.3:
			box(st, Vector3(x, 0.005, L - 2.0), Vector3(0.62, 0.012, 2.6), PAINT, false)
			x += 1.15
	var st_rail := new_st()
	for rx in [-0.65, 0.65]:
		box_t(st_rail, Transform3D(Basis.IDENTITY, Vector3(rx - 0.11, 0.012, L * 0.5)), Vector3(0.07, 0.014, L), RAIL, false)
		box_t(st_rail, Transform3D(Basis.IDENTITY, Vector3(rx + 0.11, 0.012, L * 0.5)), Vector3(0.07, 0.014, L), RAIL, false)
	var mesh := commit(st, mat_flat())
	mesh = commit(st_rail, mat_shiny(), mesh)
	if with_crosswalk:
		_ground_cross_mesh = mesh
	else:
		_ground_mesh = mesh
	return mesh

# ══════════════════════════════════════════════════════════════════════
#  BUILDINGS — Altbau & Fachwerk façades, cached variants
# ══════════════════════════════════════════════════════════════════════
static var _buildings: Array = []   # [{mesh, width}]

static func building_variants() -> Array:
	if not _buildings.is_empty():
		return _buildings
	var rng := RandomNumberGenerator.new()
	rng.seed = 20250610
	for i in 14:
		var w: float = [8.0, 10.0, 12.0][rng.randi() % 3]
		var fachwerk := i % 5 == 4
		var mesh := _build_facade(rng, w, fachwerk)
		_buildings.append({"mesh": mesh, "width": w})
	return _buildings

static func _build_facade(rng: RandomNumberGenerator, w: float, fachwerk: bool) -> ArrayMesh:
	# Building faces -X (toward street when placed on right side; flipped via scale for left)
	var st := new_st()
	var st_glass := new_st()
	var floors := rng.randi_range(3, 5) if not fachwerk else rng.randi_range(2, 3)
	var floor_h := 2.9
	var h := floors * floor_h + 1.4
	var d := 10.0
	var base_col: Color = FACADES[rng.randi() % FACADES.size()]
	if fachwerk:
		base_col = Color(0.96, 0.92, 0.82)
	# Body
	box(st, Vector3(0, h * 0.5, 0), Vector3(w, h, d), base_col)
	# Ground-floor band (shop front, slightly darker)
	box(st, Vector3(0, 0.85, 0), Vector3(w + 0.06, 1.7, d + 0.06), base_col * 0.82)
	# Cornice on top + between ground floor
	box(st, Vector3(0, h + 0.12, 0), Vector3(w + 0.5, 0.24, d + 0.5), WINDOW_FRAME)
	box(st, Vector3(0, 1.78, 0), Vector3(w + 0.3, 0.16, d + 0.3), WINDOW_FRAME * 0.96)
	# Roof
	if fachwerk:
		_prism_roof(st, Vector3(0, h, 0), w, d, 2.6, ROOF_TILE)
	else:
		var roof_col := ROOF_TILE if rng.randf() < 0.6 else ROOF_SLATE
		box(st, Vector3(0, h + 0.55, 0), Vector3(w - 0.6, 0.9, d - 0.6), roof_col)
		box(st, Vector3(rng.randf_range(-w * 0.25, w * 0.25), h + 1.35, rng.randf_range(-2, 2)), Vector3(0.7, 1.4, 0.7), base_col * 0.9)  # chimney
	# Windows on street face (face at x = -w/2; quads slightly proud)
	var fx := -w * 0.5 - 0.02
	var cols := int((d - 2.0) / 1.9)
	var lit_seed := rng.randi()
	for f in range(1, floors + 1):
		var wy := f * floor_h + 0.55
		for cidx in cols:
			var wz: float = -d * 0.5 + 1.6 + cidx * ((d - 2.6) / maxf(1.0, cols - 1.0))
			# frame
			box(st, Vector3(fx + 0.01, wy + 0.65, wz), Vector3(0.06, 1.5, 1.05), WINDOW_FRAME)
			# glass
			var lit := (lit_seed >> ((f * cols + cidx) % 24)) & 1 == 1 and rng.randf() < 0.25
			var gcol := WINDOW_GLASS_LIT if lit else WINDOW_GLASS
			box_t(st_glass, Transform3D(Basis.IDENTITY, Vector3(fx - 0.02, wy + 0.65, wz)), Vector3(0.04, 1.3, 0.85), gcol, false)
			# sill
			box(st, Vector3(fx - 0.05, wy - 0.12, wz), Vector3(0.16, 0.10, 1.15), WINDOW_FRAME)
	# Shopfront window + door + awning on ground floor
	box_t(st_glass, Transform3D(Basis.IDENTITY, Vector3(fx - 0.04, 0.95, -d * 0.18)), Vector3(0.06, 1.25, d * 0.42), WINDOW_GLASS, false)
	box(st, Vector3(fx - 0.02, 1.05, d * 0.30), Vector3(0.10, 2.1, 1.1), TIMBER)  # door
	# Awning (striped)
	var aw_colors: Array = [[BARRIER_RED, BARRIER_WHITE], [Color(0.20, 0.55, 0.35), BARRIER_WHITE], [Color(0.25, 0.45, 0.80), BARRIER_WHITE]][rng.randi() % 3]
	var seg_n := 6
	var aw_w := d * 0.5
	for sgi in seg_n:
		var az := -d * 0.40 + aw_w * sgi / seg_n
		var col: Color = aw_colors[sgi % 2]
		var t := Transform3D(Basis.from_euler(Vector3(0, 0, deg_to_rad(-28))), Vector3(fx - 0.42, 2.05, az + aw_w / seg_n * 0.5))
		box_t(st, t, Vector3(1.0, 0.06, aw_w / seg_n * 0.96), col, false)
	# Fachwerk timber braces
	if fachwerk:
		for f in range(0, floors + 1):
			box(st, Vector3(fx - 0.03, f * floor_h + 1.75 if f > 0 else 1.78, 0), Vector3(0.10, 0.18, d), TIMBER)
		for f in range(1, floors + 1):
			var wy := f * floor_h + 0.6
			var bz := -d * 0.5 + 1.0
			while bz < d * 0.5 - 1.0:
				var t1 := Transform3D(Basis.from_euler(Vector3(deg_to_rad(35), 0, 0)), Vector3(fx - 0.03, wy + 0.6, bz + 0.7))
				box_t(st, t1, Vector3(0.09, 0.14, 1.9), TIMBER, false)
				var t2 := Transform3D(Basis.from_euler(Vector3(deg_to_rad(-35), 0, 0)), Vector3(fx - 0.03, wy + 0.6, bz + 0.7))
				box_t(st, t2, Vector3(0.09, 0.14, 1.9), TIMBER, false)
				bz += 2.4
		# corner posts
		for cz in [-d * 0.5 + 0.15, d * 0.5 - 0.15]:
			box(st, Vector3(fx - 0.02, h * 0.55, cz), Vector3(0.14, h * 0.9, 0.22), TIMBER)
	var mesh := commit(st, mat_flat())
	mesh = commit(st_glass, mat_glass(), mesh)
	return mesh

static func _prism_roof(st: SurfaceTool, top_c: Vector3, w: float, d: float, rh: float, col: Color) -> void:
	# Gabled roof, ridge along Z
	var hw := w * 0.5 + 0.3
	var hd := d * 0.5 + 0.3
	var a := top_c + Vector3(-hw, 0, -hd)
	var b := top_c + Vector3(hw, 0, -hd)
	var c := top_c + Vector3(hw, 0, hd)
	var dd := top_c + Vector3(-hw, 0, hd)
	var r0 := top_c + Vector3(0, rh, -hd)
	var r1 := top_c + Vector3(0, rh, hd)
	_face(st, a, b, r0, r0, col)        # front gable (degenerate quad → triangle)
	_face(st, c, dd, r1, r1, col)       # back gable
	_face(st, b, c, r1, r0, col * 0.94) # right slope
	_face(st, dd, a, r0, r1, col * 0.94)# left slope

# ══════════════════════════════════════════════════════════════════════
#  PROPS
# ══════════════════════════════════════════════════════════════════════
static var _prop_cache: Dictionary = {}

static func prop(kind: String) -> ArrayMesh:
	if _prop_cache.has(kind):
		return _prop_cache[kind]
	var st := new_st()
	var extra_mat: Material = null
	var st2: SurfaceTool = null
	match kind:
		"lamp":
			cylinder(st, Vector3(0, 2.2, 0), 0.09, 0.06, 4.4, METAL_DARK, 8)
			box_t(st, Transform3D(Basis.from_euler(Vector3(0, 0, deg_to_rad(20))), Vector3(-0.45, 4.45, 0)), Vector3(1.1, 0.08, 0.08), METAL_DARK)
			st2 = new_st()
			box_t(st2, Transform3D(Basis.IDENTITY, Vector3(-0.95, 4.30, 0)), Vector3(0.34, 0.22, 0.34), Color(1.0, 0.95, 0.8), false)
			extra_mat = mat_glow(Color(1.0, 0.93, 0.72), 1.2)
		"tree":
			cylinder(st, Vector3(0, 0.8, 0), 0.18, 0.13, 1.6, TRUNK, 7)
			var rng := RandomNumberGenerator.new()
			rng.seed = 7
			for i in 4:
				var f: Color = FOLIAGE[i % FOLIAGE.size()]
				var off := Vector3(rng.randf_range(-0.5, 0.5), 1.9 + rng.randf_range(0, 0.9), rng.randf_range(-0.5, 0.5))
				_blob(st, off, rng.randf_range(0.7, 1.05), f)
			box(st, Vector3(0, 0.06, 0), Vector3(1.1, 0.12, 1.1), SIDEWALK * 0.85)  # tree pit
		"umbrella":
			cylinder(st, Vector3(0, 1.25, 0), 0.05, 0.04, 2.5, METAL_DARK, 6)
			cylinder(st, Vector3(0, 2.45, 0), 1.45, 0.05, 0.55, BARRIER_RED, 8, false)
			cylinder(st, Vector3(0, 0.55, 0), 0.45, 0.42, 1.1, Color(0.92, 0.90, 0.86), 8)  # table
		"litfass":
			cylinder(st, Vector3(0, 1.5, 0), 0.62, 0.62, 3.0, Color(0.55, 0.42, 0.50), 12)
			cylinder(st, Vector3(0, 3.1, 0), 0.68, 0.40, 0.5, ROOF_SLATE, 12)
			# poster bands
			cylinder(st, Vector3(0, 1.7, 0), 0.64, 0.64, 1.0, Color(0.93, 0.89, 0.80), 12, false)
			cylinder(st, Vector3(0, 0.9, 0), 0.64, 0.64, 0.45, Color(0.85, 0.40, 0.30), 12, false)
			cylinder(st, Vector3(0, 2.35, 0), 0.64, 0.64, 0.35, Color(0.30, 0.55, 0.80), 12, false)
		"bench":
			box(st, Vector3(0, 0.45, 0), Vector3(0.55, 0.07, 1.8), TRUNK * 1.25)
			box(st, Vector3(-0.22, 0.75, 0), Vector3(0.07, 0.6, 1.8), TRUNK * 1.25)
			for bz in [-0.7, 0.7]:
				box(st, Vector3(0, 0.22, bz), Vector3(0.5, 0.45, 0.09), METAL_DARK)
		"ubahn":
			# U-Bahn entrance sign post
			cylinder(st, Vector3(0, 1.6, 0), 0.06, 0.06, 3.2, METAL_DARK, 6)
			st2 = new_st()
			box_t(st2, Transform3D(Basis.IDENTITY, Vector3(0, 3.4, 0)), Vector3(1.1, 1.1, 0.16), Color(0.05, 0.28, 0.65), false)
			extra_mat = mat_glow(Color(0.05, 0.28, 0.65), 0.9)
		"hydrant":
			cylinder(st, Vector3(0, 0.35, 0), 0.16, 0.13, 0.7, BARRIER_RED, 8)
			_blob(st, Vector3(0, 0.74, 0), 0.16, BARRIER_RED)
		"bollard":
			cylinder(st, Vector3(0, 0.45, 0), 0.09, 0.07, 0.9, METAL_DARK, 7)
			_blob(st, Vector3(0, 0.92, 0), 0.10, WINDOW_FRAME)
		"flowerbox":
			box(st, Vector3(0, 0.3, 0), Vector3(0.5, 0.6, 1.4), Color(0.62, 0.48, 0.38))
			for i in 5:
				_blob(st, Vector3(randf_range(-0.12, 0.12), 0.68, -0.55 + i * 0.27), 0.16, [BARRIER_RED, Color(0.95, 0.55, 0.75), Color(0.98, 0.85, 0.30)][i % 3])
	var mesh := commit(st, mat_flat())
	if st2 != null:
		mesh = commit(st2, extra_mat, mesh)
	_prop_cache[kind] = mesh
	return mesh

static func _blob(st: SurfaceTool, c: Vector3, r: float, col: Color) -> void:
	# Icosphere-ish blob via UV sphere, low segments.
	# Faces are shaded by their height band so the volume reads as solid.
	var rings := 4
	var segs := 7
	for ri in rings:
		var p0 := PI * ri / rings - PI * 0.5
		var p1 := PI * (ri + 1) / rings - PI * 0.5
		var band := 0.78 + 0.30 * (float(ri) + 0.5) / rings   # darker base, lighter crown
		var bcol := Color(col.r * band, col.g * band, col.b * band, 1.0)
		for si in segs:
			var a0 := TAU * si / segs
			var a1 := TAU * (si + 1) / segs
			var v00 := c + Vector3(cos(p0) * cos(a0), sin(p0), cos(p0) * sin(a0)) * r
			var v01 := c + Vector3(cos(p0) * cos(a1), sin(p0), cos(p0) * sin(a1)) * r
			var v10 := c + Vector3(cos(p1) * cos(a0), sin(p1), cos(p1) * sin(a0)) * r
			var v11 := c + Vector3(cos(p1) * cos(a1), sin(p1), cos(p1) * sin(a1)) * r
			_face(st, v01, v00, v10, v11, bcol)

# ══════════════════════════════════════════════════════════════════════
#  OBSTACLES
# ══════════════════════════════════════════════════════════════════════
static func obstacle_mesh(kind: String) -> ArrayMesh:
	var key := "ob_" + kind
	if _prop_cache.has(key):
		return _prop_cache[key]
	var st := new_st()
	match kind:
		"barrier":   # JUMP over — red/white striped crowd barrier
			for px in [-0.8, 0.8]:
				box(st, Vector3(px, 0.42, 0), Vector3(0.09, 0.84, 0.09), METAL_DARK)
				box(st, Vector3(px, 0.02, 0), Vector3(0.30, 0.06, 0.30), METAL_DARK)
			for i in 4:
				var col := BARRIER_RED if i % 2 == 0 else BARRIER_WHITE
				box(st, Vector3(-0.6 + i * 0.4, 0.62, 0), Vector3(0.42, 0.30, 0.07), col, false)
			box(st, Vector3(0, 0.30, 0), Vector3(1.7, 0.07, 0.07), METAL_DARK)
		"crates":    # JUMP over — stacked beer crates
			for i in 3:
				var cx := -0.5 + i * 0.5
				box(st, Vector3(cx, 0.25, 0), Vector3(0.48, 0.42, 0.62), Color(0.85, 0.65, 0.15))
			box(st, Vector3(-0.25, 0.66, 0), Vector3(0.48, 0.42, 0.62), Color(0.30, 0.58, 0.25))
			box(st, Vector3(0.30, 0.66, 0), Vector3(0.48, 0.42, 0.62), Color(0.85, 0.65, 0.15))
		"gantry":    # SLIDE under — scaffold bar with hanging sign
			for px in [-0.95, 0.95]:
				box(st, Vector3(px, 1.1, 0), Vector3(0.12, 2.2, 0.12), Color(0.75, 0.78, 0.82))
			box(st, Vector3(0, 2.0, 0), Vector3(2.2, 0.16, 0.2), Color(0.75, 0.78, 0.82))
			box(st, Vector3(0, 1.55, 0), Vector3(1.7, 0.75, 0.08), Color(0.95, 0.55, 0.10))
			for i in 3:
				box(st, Vector3(-0.55 + i * 0.55, 1.55, -0.05), Vector3(0.34, 0.55, 0.04), BARRIER_WHITE, false)
		"cart":      # BLOCK — Imbiss / currywurst cart
			box(st, Vector3(0, 0.75, 0), Vector3(1.7, 1.3, 1.3), Color(0.92, 0.88, 0.80))
			box(st, Vector3(0, 1.48, 0), Vector3(1.8, 0.16, 1.4), BARRIER_RED)
			box(st, Vector3(0, 0.35, 0.0), Vector3(1.74, 0.5, 1.34), Color(0.55, 0.35, 0.25))
			for wx in [-0.6, 0.6]:
				cylinder(st, Vector3(wx, 0.12, 0.55), 0.16, 0.16, 0.1, METAL_DARK, 8)
			cylinder(st, Vector3(0, 2.1, 0), 1.15, 0.04, 0.9, Color(0.98, 0.80, 0.20), 8, false)
			cylinder(st, Vector3(0, 1.6, 0), 0.05, 0.04, 1.4, METAL_DARK, 6)
		"bin":       # BLOCK — BSR orange recycling container
			box(st, Vector3(0, 0.75, 0), Vector3(1.6, 1.4, 1.2), BIN_ORANGE)
			box(st, Vector3(0, 1.5, 0), Vector3(1.5, 0.22, 1.1), BIN_ORANGE * 0.85)
			for wx in [-0.55, 0.55]:
				cylinder(st, Vector3(wx, 0.1, 0.5), 0.12, 0.12, 0.12, METAL_DARK, 8)
			box(st, Vector3(0, 0.9, -0.61), Vector3(1.1, 0.5, 0.04), BARRIER_WHITE, false)
		"roadworks": # BLOCK — striped baustelle barrier, full
			box(st, Vector3(0, 0.1, 0), Vector3(1.8, 0.2, 0.5), BARRIER_RED)
			for i in 4:
				var col2 := BARRIER_RED if i % 2 == 0 else BARRIER_WHITE
				var t := Transform3D(Basis.from_euler(Vector3(0, 0, deg_to_rad(-18))), Vector3(-0.6 + i * 0.42, 0.85, 0))
				box_t(st, t, Vector3(0.44, 0.8, 0.12), col2, false)
			box(st, Vector3(0, 1.42, 0), Vector3(1.8, 0.14, 0.18), BARRIER_RED)
	var mesh := commit(st, mat_flat())
	_prop_cache[key] = mesh
	return mesh

static func tram_mesh() -> ArrayMesh:
	if _prop_cache.has("tram"):
		return _prop_cache["tram"]
	var st := new_st()
	var st_glass := new_st()
	var L := 11.0
	# Body
	box(st, Vector3(0, 1.25, 0), Vector3(1.9, 1.9, L), TRAM_YELLOW)
	box(st, Vector3(0, 2.32, 0), Vector3(1.75, 0.30, L - 0.4), TRAM_ROOF)
	# Nose taper (front toward -z)
	box_t(st, Transform3D(Basis.from_euler(Vector3(deg_to_rad(18), 0, 0)), Vector3(0, 1.1, -L * 0.5 - 0.25)), Vector3(1.85, 1.5, 0.9), TRAM_YELLOW)
	# Skirt
	box(st, Vector3(0, 0.35, 0), Vector3(1.8, 0.5, L - 0.3), METAL_DARK)
	# Windows strip both sides + front
	box_t(st_glass, Transform3D(Basis.IDENTITY, Vector3(-0.97, 1.55, 0)), Vector3(0.04, 0.75, L - 1.6), WINDOW_GLASS, false)
	box_t(st_glass, Transform3D(Basis.IDENTITY, Vector3(0.97, 1.55, 0)), Vector3(0.04, 0.75, L - 1.6), WINDOW_GLASS, false)
	box_t(st_glass, Transform3D(Basis.from_euler(Vector3(deg_to_rad(18), 0, 0)), Vector3(0, 1.62, -L * 0.5 - 0.42)), Vector3(1.5, 0.7, 0.06), WINDOW_GLASS * 0.9, false)
	# Doors
	for dz in [-L * 0.22, L * 0.22]:
		box(st, Vector3(-0.96, 1.1, dz), Vector3(0.05, 1.5, 1.1), TRAM_ROOF * 0.94)
		box(st, Vector3(0.96, 1.1, dz), Vector3(0.05, 1.5, 1.1), TRAM_ROOF * 0.94)
	# Pantograph
	box_t(st, Transform3D(Basis.from_euler(Vector3(0, 0, deg_to_rad(30))), Vector3(0, 2.85, 1.5)), Vector3(0.06, 1.0, 0.06), METAL_DARK)
	box_t(st, Transform3D(Basis.from_euler(Vector3(0, 0, deg_to_rad(-30))), Vector3(0, 2.85, 2.3)), Vector3(0.06, 1.0, 0.06), METAL_DARK)
	box(st, Vector3(0, 3.28, 1.9), Vector3(1.2, 0.06, 0.10), METAL_DARK)
	# BVG-ish front lights
	box(st, Vector3(-0.55, 0.85, -L * 0.5 - 0.62), Vector3(0.3, 0.14, 0.06), WINDOW_FRAME, false)
	box(st, Vector3(0.55, 0.85, -L * 0.5 - 0.62), Vector3(0.3, 0.14, 0.06), WINDOW_FRAME, false)
	var mesh := commit(st, mat_flat())
	mesh = commit(st_glass, mat_glass(), mesh)
	_prop_cache["tram"] = mesh
	return mesh

# ══════════════════════════════════════════════════════════════════════
#  COIN
# ══════════════════════════════════════════════════════════════════════
static func coin_mesh() -> ArrayMesh:
	if _prop_cache.has("coin"):
		return _prop_cache["coin"]
	var st := new_st()
	# Rim (cylinder lying on its side: axis = Z so face shows toward camera)
	var t := Transform3D(Basis.from_euler(Vector3(deg_to_rad(90), 0, 0)), Vector3.ZERO)
	_coin_disc(st, t, 0.48, 0.11, COIN_GOLD)
	_coin_disc(st, t, 0.34, 0.13, COIN_GOLD * 1.15)
	var mesh := commit(st, mat_glow(COIN_GOLD, 0.55))
	_prop_cache["coin"] = mesh
	return mesh

static func _coin_disc(st: SurfaceTool, t: Transform3D, r: float, h: float, col: Color) -> void:
	var segs := 14
	for i in segs:
		var a0 := TAU * i / segs
		var a1 := TAU * (i + 1) / segs
		var b0 := t * Vector3(cos(a0) * r, -h * 0.5, sin(a0) * r)
		var b1 := t * Vector3(cos(a1) * r, -h * 0.5, sin(a1) * r)
		var t0 := t * Vector3(cos(a0) * r, h * 0.5, sin(a0) * r)
		var t1 := t * Vector3(cos(a1) * r, h * 0.5, sin(a1) * r)
		_face(st, b1, b0, t0, t1, col * 0.92)
		st.set_color(col)
		st.set_normal((t.basis * Vector3.UP).normalized())
		st.add_vertex(t * Vector3(0, h * 0.5, 0)); st.add_vertex(t1); st.add_vertex(t0)
		st.set_color(col * 0.85)
		st.set_normal((t.basis * Vector3.DOWN).normalized())
		st.add_vertex(t * Vector3(0, -h * 0.5, 0)); st.add_vertex(b0); st.add_vertex(b1)

# ══════════════════════════════════════════════════════════════════════
#  ARTICLE GATE — one arch per lane
# ══════════════════════════════════════════════════════════════════════
static func gate_arch_mesh(article: String) -> ArrayMesh:
	var key := "arch_" + article
	if _prop_cache.has(key):
		return _prop_cache[key]
	var col: Color = ARTICLE_COLORS[article]
	var st := new_st()
	var w := 1.8
	var h := 2.7
	# pillars
	box(st, Vector3(-w * 0.5, h * 0.5, 0), Vector3(0.22, h, 0.22), col, false)
	box(st, Vector3(w * 0.5, h * 0.5, 0), Vector3(0.22, h, 0.22), col, false)
	# header
	box(st, Vector3(0, h + 0.28, 0), Vector3(w + 0.55, 0.62, 0.26), col, false)
	# base shoes
	box(st, Vector3(-w * 0.5, 0.07, 0), Vector3(0.4, 0.14, 0.4), col * 0.8, false)
	box(st, Vector3(w * 0.5, 0.07, 0), Vector3(0.4, 0.14, 0.4), col * 0.8, false)
	var mesh := commit(st, mat_glow(col, 0.9))
	_prop_cache[key] = mesh
	return mesh

# ══════════════════════════════════════════════════════════════════════
#  BACKDROP — skyline + Fernsehturm + clouds
# ══════════════════════════════════════════════════════════════════════
static func backdrop_mesh() -> ArrayMesh:
	if _prop_cache.has("backdrop"):
		return _prop_cache["backdrop"]
	var st := new_st()
	var sil := Color(0.62, 0.72, 0.88)
	var sil2 := Color(0.70, 0.79, 0.93)
	var rng := RandomNumberGenerator.new()
	rng.seed = 99
	# Two rows of distant blocks spanning wide
	var x := -90.0
	while x < 90.0:
		var bw := rng.randf_range(8, 16)
		var bh := rng.randf_range(10, 30)
		box(st, Vector3(x + bw * 0.5, bh * 0.5, rng.randf_range(-6, 6)), Vector3(bw, bh, 8), sil if rng.randf() < 0.5 else sil2, false)
		x += bw + rng.randf_range(1, 5)
	# Fernsehturm
	var tx := 14.0
	cylinder(st, Vector3(tx, 27, -4), 2.4, 0.9, 54.0, Color(0.80, 0.86, 0.96), 10)
	_blob(st, Vector3(tx, 56, -4), 4.0, Color(0.88, 0.93, 1.0))
	cylinder(st, Vector3(tx, 63, -4), 0.5, 0.12, 14.0, Color(0.85, 0.30, 0.30), 6)
	var mesh := commit(st, mat_flat())
	_prop_cache["backdrop"] = mesh
	return mesh

static func cloud_mesh(seed_v: int) -> ArrayMesh:
	var key := "cloud_%d" % seed_v
	if _prop_cache.has(key):
		return _prop_cache[key]
	var st := new_st()
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_v
	for i in 5:
		_blob(st, Vector3(rng.randf_range(-3, 3), rng.randf_range(-0.5, 0.7), rng.randf_range(-1, 1)), rng.randf_range(1.2, 2.4), Color.WHITE)
	var mesh := commit(st, mat_cloud())
	_prop_cache[key] = mesh
	return mesh
