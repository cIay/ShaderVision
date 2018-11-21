#version 300 es

precision mediump float;
out vec4 fragColor;

uniform vec2 resolution;
uniform sampler2D frame;

void main(void) {
	vec2 uv = gl_FragCoord.xy / resolution.xy;
	vec4 c = texture(frame, uv);

	fragColor = vec4((vec3(1.0) - c.rgb), 1.0);
}