shader_type canvas_item;

uniform sampler2D screen_tex : hint_screen_texture, filter_nearest;
uniform float strength : hint_range(0.0, 0.02) = 0.002;
uniform float vignette_strength : hint_range(0.0, 2.0) = 0.35;
uniform float vignette_softness : hint_range(0.0, 2.0) = 0.7;

void fragment() {
	vec2 uv = SCREEN_UV;
	vec2 center = vec2(0.5);
	vec2 dir = uv - center;
	float dist = length(dir);
	float amt = strength * dist * 2.2;

	float r = texture(screen_tex, uv - dir * amt).r;
	float g = texture(screen_tex, uv).g;
	float b = texture(screen_tex, uv + dir * amt).b;

	vec3 col = vec3(r, g, b);
	float vig = smoothstep(1.0, 1.0 - vignette_softness, dist * (1.0 + vignette_strength));
	col *= mix(1.0, vig, vignette_strength);
	COLOR = vec4(col, 1.0);
}
