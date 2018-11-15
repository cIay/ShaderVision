precision mediump float;

uniform vec2 resolution;
uniform sampler2D frame;

void main(void) {
	vec2 uv = gl_FragCoord.xy / resolution.xy;
	vec4 c = texture2D(frame, uv);

	gl_FragColor = vec4((vec3(1.0) - c.rgb), 1.0);
}