shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

uniform vec3 base_color : source_color = vec3(0.94, 0.90, 0.80);
uniform vec3 stain_color : source_color = vec3(0.82, 0.78, 0.68);
uniform float roughness_val : hint_range(0.0, 1.0) = 0.88;
uniform float scale : hint_range(1.0, 80.0) = 25.0;
uniform float stain_amount : hint_range(0.0, 1.0) = 0.3;

// Simple hash-based noise
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
	for (int i = 0; i < 5; i++) {
		v += amp * noise(p);
		p *= 2.1;
		amp *= 0.48;
	}
	return v;
}

void fragment() {
	vec2 uv = UV * scale;

	// Multi-octave stucco texture
	float n = fbm(uv);
	float fine = fbm(uv * 3.5 + 7.3);

	// Water stain streaks (vertical bias)
	float streak = fbm(vec2(uv.x * 0.5, uv.y * 2.0) + 42.0);
	streak = smoothstep(0.45, 0.7, streak) * stain_amount;

	vec3 col = mix(base_color, stain_color, streak);
	// Add fine plaster grain variation
	col *= 0.9 + 0.2 * n;
	col += 0.03 * (fine - 0.5);

	ALBEDO = col;
	ROUGHNESS = roughness_val + 0.08 * n;
	NORMAL_MAP = vec3(
		dFdx(n) * 3.0 + 0.5,
		dFdy(n) * 3.0 + 0.5,
		1.0
	);
	METALLIC = 0.0;
}
