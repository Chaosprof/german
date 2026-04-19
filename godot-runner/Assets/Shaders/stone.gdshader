shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

uniform vec3 stone_light : source_color = vec3(0.72, 0.68, 0.62);
uniform vec3 stone_dark : source_color = vec3(0.50, 0.47, 0.42);
uniform vec3 moss_tint : source_color = vec3(0.28, 0.35, 0.18);
uniform float roughness_val : hint_range(0.0, 1.0) = 0.85;
uniform float block_rows : hint_range(2.0, 20.0) = 8.0;
uniform float block_cols : hint_range(2.0, 20.0) = 6.0;

float hash(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = hash(i);
	float b = hash(i + vec2(1.0, 0.0));
	float c = hash(i + vec2(0.0, 1.0));
	float d = hash(i + vec2(1.0, 1.0));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
	float v = 0.0;
	float amp = 0.5;
	for (int i = 0; i < 4; i++) {
		v += amp * noise(p);
		p *= 2.0;
		amp *= 0.5;
	}
	return v;
}

void fragment() {
	vec2 uv = UV;

	float row = floor(uv.y * block_rows);
	float offset = mod(row, 2.0) * 0.5;
	vec2 block_uv = vec2(uv.x * block_cols + offset, uv.y * block_rows);
	vec2 block_id = floor(block_uv);
	vec2 block_f = fract(block_uv);

	float block_rand = hash(block_id);

	// Mortar gaps
	float mortar_x = smoothstep(0.0, 0.05, block_f.x) * smoothstep(1.0, 0.95, block_f.x);
	float mortar_y = smoothstep(0.0, 0.05, block_f.y) * smoothstep(1.0, 0.95, block_f.y);
	float mortar = mortar_x * mortar_y;

	// Per-block color variation
	vec3 block_col = mix(stone_light, stone_dark, block_rand * 0.5 + 0.1);

	// Surface erosion texture
	float erosion = fbm(block_uv * 3.0 + block_id * 7.0);
	block_col *= 0.85 + 0.3 * erosion;

	// Fine grain
	float grain = noise(block_uv * 8.0);
	block_col += 0.03 * (grain - 0.5);

	// Weathering stains (vertical streaks)
	float stain = fbm(vec2(uv.x * 4.0, uv.y * 8.0) + 50.0);
	stain = smoothstep(0.5, 0.75, stain) * 0.2;
	block_col = mix(block_col, stone_dark * 0.7, stain);

	// Moss near bottom
	float moss = smoothstep(0.3, 0.0, uv.y) * smoothstep(0.5, 0.7, hash(block_id + 31.0));
	block_col = mix(block_col, moss_tint, moss * 0.4);

	// Mortar color
	vec3 mortar_col = vec3(0.58, 0.55, 0.50);
	vec3 col = mix(mortar_col, block_col, mortar);

	float bump = mortar * 0.7 + erosion * 0.3;

	ALBEDO = col;
	ROUGHNESS = roughness_val + 0.1 * (1.0 - mortar);
	NORMAL_MAP = vec3(
		dFdx(bump) * 4.0 + 0.5,
		dFdy(bump) * 4.0 + 0.5,
		1.0
	);
	METALLIC = 0.0;
}
