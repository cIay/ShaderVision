precision mediump float;

uniform vec2 resolution;
uniform sampler2D freqData;
uniform sampler2D texture;

void main(void) {
	vec2 uv = gl_FragCoord.xy / resolution.xy;
	vec4 c = texture2D(texture, uv);
	vec4 s = texture2D(freqData, vec2(uv.x, 0));

	if (uv.y > s.r) {
		s.rgb = vec3(0.0);
	}
	else {
		s.rgb = vec3(1.0);
	}

	gl_FragColor = vec4(mix(c.rgb, s.rgb, 0.5), 1.0);
}
