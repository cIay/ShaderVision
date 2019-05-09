#version 300 es
precision mediump float;

uniform vec2 resolution;
uniform sampler2D frame, prevFrame;

out vec4 fragColor;

#define TIME_DERIVATIVE

#define SOBEL_X float[](\
	-1., 0., 1.,\
	-2., 0., 2.,\
	-1., 0., 1.\
)

#define SOBEL_Y float[](\
	-1., -2., -1.,\
	 0.,  0.,  0.,\
	 1.,  2.,  1.\
)

#define LAPLACIAN float[](\
	0.,  1., 0.,\
	1., -4., 1.,\
	0.,  1., 0.\
)

float kernel_x[9] = SOBEL_X;
float kernel_y[9] = SOBEL_Y;

float lum(vec3 p) {
	return 0.2126*p.r + 0.7152*p.g + 0.0722*p.b;
}

void main(void) {
	vec2 uv = gl_FragCoord.xy / resolution.xy;

	float dx = 1.0 / resolution.x;
	float dy = 1.0 / resolution.y;

	vec3 nw = texture(frame, vec2(uv.x - dx, uv.y + dy)).rgb;
	vec3 n  = texture(frame, vec2(uv.x,      uv.y + dy)).rgb;
	vec3 ne = texture(frame, vec2(uv.x + dx, uv.y + dy)).rgb;
	vec3 w  = texture(frame, vec2(uv.x - dx, uv.y     )).rgb;
	vec3 c  = texture(frame, vec2(uv.x,      uv.y     )).rgb;
	vec3 e  = texture(frame, vec2(uv.x + dx, uv.y     )).rgb;
	vec3 sw = texture(frame, vec2(uv.x - dx, uv.y - dy)).rgb;
	vec3 s  = texture(frame, vec2(uv.x,      uv.y - dy)).rgb;
	vec3 se = texture(frame, vec2(uv.x + dx, uv.y - dy)).rgb;

	vec3 grad_x = nw*kernel_x[0] + n*kernel_x[1] + ne*kernel_x[2] +
	               w*kernel_x[3] + c*kernel_x[4] +  e*kernel_x[5] +
	              sw*kernel_x[6] + s*kernel_x[7] + se*kernel_x[8];
	float x = (lum(grad_x) + 1.0) * 0.5;

	vec3 grad_y = nw*kernel_y[0] + n*kernel_y[1] + ne*kernel_y[2] +
	               w*kernel_y[3] + c*kernel_y[4] +  e*kernel_y[5] +
	              sw*kernel_y[6] + s*kernel_y[7] + se*kernel_y[8];
	float y = (lum(grad_y) + 1.0) * 0.5;

#ifdef TIME_DERIVATIVE
	vec3 grad_t = c - texture(prevFrame, uv).rgb;
	float t = (lum(grad_t) + 1.0) * 0.5;
#else
	float t = 1.0;
#endif

	fragColor = vec4(vec3(x, y, t), 1.0);
}