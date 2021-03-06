#version 300 es

precision mediump float;
out vec4 fragColor;

uniform vec2 resolution;
uniform sampler2D frame;

void main(void) {
	vec2 uv = gl_FragCoord.xy / resolution.xy;
	vec4 c = texture(frame, uv);

	float luminance = (c.r + c.g + c.b) / 3.0; 
	float saturation = (abs(c.r - luminance) + abs(c.g - luminance) + abs(c.b - luminance)) / 3.0 * (1.0 - luminance);

	float red = c.r;
	float green = c.g;
	float blue = c.b;

	red += (c.r - luminance) * 10.0 * saturation;
	green += (c.g - luminance) * 10.0 * saturation;
	blue += (c.b - luminance) * 10.0 * saturation;

	fragColor = vec4(red, green, blue, c.a);
}