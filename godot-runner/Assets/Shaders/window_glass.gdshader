shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

uniform vec3 glass_color : source_color = vec3(0.55, 0.72, 0.88);
uniform vec3 warm_glow : source_color = vec3(0.95, 0.80, 0.45);
uniform float glow_strength : hint_range(0.0, 2.0) = 0.6;
uniform float roughness_val : hint_range(0.0, 1.0) = 0.12;
uniform float pane_cols : hint_range(1.0, 6.0) = 2.0;
uniform float pane_rows : hint_range(1.0, 6.0) = 3.0;

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
	vec2 uv = UV;

	// Window pane grid
	vec2 pane_uv = vec2(uv.x * pane_cols, uv.y * pane_rows);
	vec2 pane_f = fract(pane_uv);
	vec2 pane_id = floor(pane_uv);

	// Frame (mullions)
	float frame_x = smoothstep(0.0, 0.08, pane_f.x) * smoothstep(1.0, 0.92, pane_f.x);
	float frame_y = smoothstep(0.0, 0.08, pane_f.y) * smoothstep(1.0, 0.92, pane_f.y);
	float frame = frame_x * frame_y;

	// Per-pane slight color shift
	float pane_rand = hash(pane_id);

	// Subtle distortion/imperfection in old glass
	float distort = noise(pane_uv * 6.0 + pane_id * 3.0) * 0.15;

	// Warm interior glow varies per pane
	float glow_vary = 0.7 + 0.3 * pane_rand;
	vec3 glow = warm_glow * glow_strength * glow_vary;

	// Glass base with slight color variation
	vec3 col = glass_color + distort * 0.1;
	col = mix(col, glow, 0.5 + 0.3 * (1.0 - uv.y));

	// Frame is dark wood
	vec3 frame_col = vec3(0.18, 0.12, 0.06);
	col = mix(frame_col, col, frame);

	// Reflection highlight near top
	float refl = smoothstep(0.6, 0.95, uv.y) * 0.3;
	col += refl * vec3(0.8, 0.85, 0.9);

	ALBEDO = col;
	ROUGHNESS = mix(0.7, roughness_val, frame);
	METALLIC = mix(0.0, 0.25, frame);
	EMISSION = glow * frame * 0.5;
}
