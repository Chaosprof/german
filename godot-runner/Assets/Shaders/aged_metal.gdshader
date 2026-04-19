shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

uniform vec3 metal_color : source_color = vec3(0.15, 0.18, 0.15);
uniform vec3 patina_color : source_color = vec3(0.25, 0.38, 0.30);
uniform float roughness_val : hint_range(0.0, 1.0) = 0.40;
uniform float metallic_val : hint_range(0.0, 1.0) = 0.75;
uniform float patina_amount : hint_range(0.0, 1.0) = 0.3;

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
	vec2 uv = UV * 8.0;

	// Brushed metal streaks (vertical for lamp pole)
	float brushed = noise(vec2(uv.x * 2.0, uv.y * 20.0));
	float fine = noise(vec2(uv.x * 4.0, uv.y * 40.0));

	// Patina/oxidation spots
	float patina = fbm(uv * 0.8 + 17.0);
	patina = smoothstep(0.4, 0.7, patina) * patina_amount;

	// Scratches
	float scratch = noise(vec2(uv.x * 1.0, uv.y * 30.0));
	scratch = smoothstep(0.75, 0.85, scratch) * 0.15;

	vec3 col = metal_color;
	col *= 0.9 + 0.2 * brushed;
	col += scratch * vec3(0.3);
	col = mix(col, patina_color, patina);

	float bump = brushed * 0.5 + fine * 0.3 + scratch * 0.2;

	ALBEDO = col;
	ROUGHNESS = roughness_val + 0.2 * patina - 0.05 * scratch;
	METALLIC = metallic_val * (1.0 - patina * 0.4);
	NORMAL_MAP = vec3(
		dFdx(bump) * 2.0 + 0.5,
		dFdy(bump) * 2.0 + 0.5,
		1.0
	);
}
