#version 300 es

precision mediump float;
out vec4 fragColor;

uniform vec2 resolution;
uniform sampler2D frame;
uniform float bass;
uniform float avgBass;

#define PI 3.14159265359

bool beat(float e, float E, float C) { return e > E*C; }

float getAberrationFactor() {
	if (beat(bass, avgBass, 1.3)) {
		return bass * 30.0;
	}
	else {
		return bass * 20.0;
	}
}

void main(void) {
	vec2 uv = gl_FragCoord.xy / resolution.xy;

	float aberrationFactor = getAberrationFactor();

	float xTrans = uv.x*2.0 - 1.0;
	float yTrans = 1.0 - uv.y*2.0;

	float angle = atan(yTrans/xTrans) + PI;
	if (sign(xTrans) == 1.0) {
		angle += PI;
	}
	float radius = sqrt(pow(xTrans, 2.0) + pow(yTrans, 2.0));

	vec2 rCoords, gCoords, bCoords;

	vec3 radii = vec3(radius + radius*aberrationFactor, radius, radius - radius*aberrationFactor);

	rCoords.x = (radii.r * cos(angle) + 1.0) / 2.0;
	rCoords.y = -(radii.r * sin(angle) - 1.0) / 2.0;

	gCoords.x = (radii.g * cos(angle) + 1.0) / 2.0;
	gCoords.y = -(radii.g * sin(angle) - 1.0) / 2.0;

	bCoords.x = (radii.b * cos(angle) + 1.0) / 2.0;
	bCoords.y = -(radii.b * sin(angle) - 1.0) / 2.0;

	float red = texture(frame, rCoords).r;
	float green = texture(frame, gCoords).g;
	float blue = texture(frame, bCoords).b;

	fragColor = vec4(red, green, blue, 1.0);
}