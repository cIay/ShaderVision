precision mediump float;

uniform vec2 resolution;
uniform sampler2D frame;
uniform float energy;

#define PI 3.14159265359

void main(void) {
	vec2 uv = gl_FragCoord.xy / resolution.xy;

	float aberrationFactor = 0.05;

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

	float red = texture2D(frame, rCoords).r;
	float green = texture2D(frame, gCoords).g;
	float blue = texture2D(frame, bCoords).b;

	gl_FragColor = vec4(red, green, blue, 1.0);
}