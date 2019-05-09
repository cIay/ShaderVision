#version 300 es
precision mediump float;

uniform vec2 resolution;
uniform sampler2D frame;

out vec4 fragColor;

#define EMBOSS

#ifdef BLUR
float kernel[] = float[](
	0.0625, 0.125, 0.0625,
	0.125,  0.25,  0.125,
	0.0625, 0.125, 0.0625
);
#endif

#ifdef EMBOSS
float kernel[] = float[](
	-2., -1., 0.,
	-1.,  1., 1.,
	 0.,  1., 2.
);
#endif

#ifdef OUTLINE
float kernel[] = float[](
	-1., -1., -1.,
	-1.,  8., -1.,
	-1., -1., -1.
);
#endif

void main(void) {
	vec2 uv = gl_FragCoord.xy / resolution.xy;
	float dx = 1.0 / resolution.x;
	float dy = 1.0 / resolution.y;

	vec3 sum = texture(frame, vec2(uv.x - dx, uv.y + dy)).rgb * kernel[0] +
               texture(frame, vec2(uv.x,      uv.y + dy)).rgb * kernel[1] +
               texture(frame, vec2(uv.x + dx, uv.y + dy)).rgb * kernel[2] +
               texture(frame, vec2(uv.x - dx, uv.y     )).rgb * kernel[3] +
               texture(frame, vec2(uv.x,      uv.y     )).rgb * kernel[4] +
               texture(frame, vec2(uv.x + dx, uv.y     )).rgb * kernel[5] +
               texture(frame, vec2(uv.x - dx, uv.y - dy)).rgb * kernel[6] +
               texture(frame, vec2(uv.x,      uv.y - dy)).rgb * kernel[7] +
               texture(frame, vec2(uv.x + dx, uv.y - dy)).rgb * kernel[8];

	fragColor = vec4(sum, 1.0);
}