shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

uniform vec3 stone_base : source_color = vec3(0.38, 0.35, 0.32);
uniform vec3 stone_light : source_color = vec3(0.52, 0.48, 0.44);
uniform vec3 grout_color : source_color = vec3(0.22, 0.20, 0.18);
uniform float roughness_val : hint_range(0.0, 1.0) = 0.90;
uniform float scale : hint_range(2.0, 40.0) = 12.0;

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

void fragment() {
	vec2 uv = UV * scale;

	// Irregular cobblestone grid with offset rows
	float row = floor(uv.y);
	float offset = hash(vec2(row, 0.0)) * 0.6;
	vec2 stone_uv = vec2(uv.x + offset, uv.y);
	vec2 stone_id = floor(stone_uv);
	vec2 stone_f = fract(stone_uv);

	// Per-stone random values
	float r1 = hash(stone_id);
	float r2 = hash(stone_id + 13.0);

	// Rounded stone shape
	vec2 centered = stone_f - 0.5;
	float stone_size = 0.38 + r2 * 0.08;
	float dist = length(centered / vec2(stone_size, stone_size * (0.8 + r1 * 0.3)));
	float stone_mask = 1.0 - smoothstep(0.85, 1.0, dist);

	// Per-stone color
	vec3 col = mix(stone_base, stone_light, r1 * 0.7);

	// Surface variation within each stone
	float surface = noise(stone_uv * 4.0 + stone_id * 5.0);
	col *= 0.85 + 0.3 * surface;

	// Wet spots (darker patches)
	float wet = noise(uv * 0.5 + 30.0);
	wet = smoothstep(0.55, 0.75, wet) * 0.15;
	col *= 1.0 - wet;

	// Grout between stones
	col = mix(grout_color, col, stone_mask);

	float bump = stone_mask * 0.7 + surface * 0.3;

	ALBEDO = col;
	ROUGHNESS = roughness_val - 0.08 * wet;
	NORMAL_MAP = vec3(
		dFdx(bump) * 5.0 + 0.5,
		dFdy(bump) * 5.0 + 0.5,
		1.0
	);
	METALLIC = 0.0;
}
