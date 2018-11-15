precision mediump float;

uniform vec2 resolution;
uniform sampler2D freqData;
uniform sampler2D frame;

void main(void) {
	vec2 uv = gl_FragCoord.xy / resolution.xy;
	vec4 c = texture2D(frame, uv);

	if (uv.y < texture2D(freqData, vec2(uv.x, 0)).r) {
		c.rgb = mix(c.rgb, vec3(0.0), 0.5);
	}

	gl_FragColor = vec4(c.rgb, 1.0);
}
