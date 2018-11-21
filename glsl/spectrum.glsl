#version 300 es

precision mediump float;
out vec4 fragColor;

uniform vec2 resolution;
uniform sampler2D freqData;
uniform sampler2D frame;

void main(void) {
	vec2 uv = gl_FragCoord.xy / resolution.xy;
	vec4 c = texture(frame, uv);

	if (uv.y < texture(freqData, vec2(uv.x, 0)).r) {
		c.rgb = mix(c.rgb, vec3(0.0), 0.5);
	}

	fragColor = vec4(c.rgb, 1.0);
}
