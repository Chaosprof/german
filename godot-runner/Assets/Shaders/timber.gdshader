shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

uniform vec3 wood_dark : source_color = vec3(0.22, 0.12, 0.04);
uniform vec3 wood_light : source_color = vec3(0.38, 0.22, 0.10);
uniform float roughness_val : hint_range(0.0, 1.0) = 0.72;
uniform float grain_scale : hint_range(1.0, 60.0) = 12.0;

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
	vec2 uv = UV * grain_scale;

	// Wood grain: stretch along Y (vertical beams)
	float grain = fbm(vec2(uv.x * 0.3, uv.y * 4.0));
	float fine_grain = noise(vec2(uv.x * 0.8, uv.y * 12.0));

	// Ring-like pattern
	float rings = sin(uv.y * 8.0 + grain * 6.0) * 0.5 + 0.5;
	rings = smoothstep(0.3, 0.7, rings);

	float t = grain * 0.5 + rings * 0.3 + fine_grain * 0.2;
	vec3 col = mix(wood_dark, wood_light, t);

	// Weathering: darken edges and add age spots
	float weather = fbm(uv * 0.5 + 100.0);
	col *= 0.85 + 0.3 * weather;

	// Knots
	float knot = 1.0 - smoothstep(0.0, 0.12, length(fract(uv * 0.15) - 0.5));
	col = mix(col, wood_dark * 0.6, knot * 0.7);

	ALBEDO = col;
	ROUGHNESS = roughness_val + 0.1 * grain;
	NORMAL_MAP = vec3(
		dFdx(grain) * 2.0 + 0.5,
		dFdy(grain) * 2.0 + 0.5,
		1.0
	);
	METALLIC = 0.0;
}
