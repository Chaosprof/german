shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

uniform vec3 tile_color : source_color = vec3(0.55, 0.20, 0.12);
uniform vec3 tile_dark : source_color = vec3(0.38, 0.13, 0.08);
uniform vec3 moss_color : source_color = vec3(0.25, 0.32, 0.15);
uniform float roughness_val : hint_range(0.0, 1.0) = 0.80;
uniform float tile_rows : hint_range(2.0, 30.0) = 10.0;
uniform float tile_cols : hint_range(2.0, 30.0) = 8.0;

float hash(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(hash(i), hash(i + vec2(1, 0)), f.x),
		mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x),
		f.y
	);
}

void fragment() {
	vec2 uv = UV;

	// Stagger every other row
	float row = floor(uv.y * tile_rows);
	float offset = mod(row, 2.0) * 0.5;
	vec2 tile_uv = vec2(uv.x * tile_cols + offset, uv.y * tile_rows);
	vec2 tile_id = floor(tile_uv);
	vec2 tile_f = fract(tile_uv);

	// Per-tile random variation
	float tile_rand = hash(tile_id);
	float tile_rand2 = hash(tile_id + 57.0);

	// Tile shape: rounded rectangle with shadow at top
	float edge = smoothstep(0.0, 0.08, tile_f.x) * smoothstep(1.0, 0.92, tile_f.x);
	float top_shadow = smoothstep(0.0, 0.25, tile_f.y);
	float tile_mask = edge * top_shadow;

	// Color variation per tile
	vec3 col = mix(tile_color, tile_dark, tile_rand * 0.6);
	col *= 0.8 + 0.4 * tile_mask;

	// Surface texture
	float n = noise(tile_uv * 4.0);
	col += 0.04 * (n - 0.5);

	// Moss in crevices and on some tiles
	float moss = smoothstep(0.6, 0.8, tile_rand2) * smoothstep(0.15, 0.0, tile_f.y);
	col = mix(col, moss_color, moss * 0.6);

	// Mortar lines
	float mortar_x = smoothstep(0.0, 0.04, tile_f.x) * smoothstep(1.0, 0.96, tile_f.x);
	float mortar_y = smoothstep(0.0, 0.04, tile_f.y);
	float mortar = 1.0 - mortar_x * mortar_y;
	col = mix(col, vec3(0.45, 0.42, 0.38), mortar * 0.5);

	// Bump from tile edges
	float bump = tile_mask * 0.8 + n * 0.2;

	ALBEDO = col;
	ROUGHNESS = roughness_val + 0.1 * (1.0 - tile_mask);
	NORMAL_MAP = vec3(
		dFdx(bump) * 4.0 + 0.5,
		dFdy(bump) * 4.0 + 0.5,
		1.0
	);
	METALLIC = 0.0;
}
