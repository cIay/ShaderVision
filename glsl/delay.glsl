#version 300 es
precision mediump float;

uniform vec2 resolution;
uniform sampler2D frame, prevFrame, thisBuf;
uniform int drawCount;

out vec4 fragColor;

float lum(vec3 p) {
	return 0.2126*p.r + 0.7152*p.g + 0.0722*p.b;
}

vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}


void main(void) {
	vec2 uv = gl_FragCoord.xy / resolution.xy;
	vec3 c = texture(frame, uv).rgb;
	vec3 prev = texture(prevFrame, uv).rgb;
	vec3 diff = lum(abs(c - prev)) * c;
	vec3 buf = texture(thisBuf, uv).rgb;

	c = mix(c, buf, 0.90);
	const int rotLen = 40;
	int drawMod = drawCount % rotLen;
	float rot = float(drawMod) / float(rotLen);

	diff = rgb2hsv(diff);
	float sum = diff.r + rot;
	diff.r = (sum > 1.0) ? sum - 1.0 : sum;
	diff.g += 0.5;
	diff = hsv2rgb(diff);
	fragColor = vec4(c *(1.0 - diff), 1.0);
}