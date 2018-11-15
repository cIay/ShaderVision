precision mediump float;

uniform vec2 resolution;
uniform sampler2D frame;
uniform float time;

float EffectDuration = 1.0;
float EffectFadeInTimeFactor = 0.5;
float EffectWidth = 0.4;
float EffectMaxTexelOffset = 20.0;

vec2 GetOffsetFromCenter(vec2 screenCoords, vec2 screenSize) {
	vec2 halfScreenSize = screenSize / 2.0;
	return (screenCoords.xy - halfScreenSize) / min(halfScreenSize.x, halfScreenSize.y);
}

vec2 GetDistortionTexelOffset(vec2 offsetDirection, float offsetDistance, float t) {
	float progress = mod(t, EffectDuration) / EffectDuration;
	
	float halfWidth = EffectWidth / 2.0;
	float lower = 1.0 - smoothstep(progress - halfWidth, progress, offsetDistance);
	float upper = smoothstep(progress, progress + halfWidth, offsetDistance);
	
	float band = 1.0 - (upper + lower);
	
	float strength = 1.0 - progress;
	float fadeStrength = smoothstep(0.0, EffectFadeInTimeFactor, progress);
	
	float distortion = band * strength * fadeStrength;
	
	return distortion * offsetDirection * EffectMaxTexelOffset;
}

vec3 GetTextureOffset(vec2 coords, vec2 textureSize, vec2 texelOffset) {
	vec2 texelSize = 1.0 / textureSize;
	vec2 offsetCoords = coords + texelSize * texelOffset;
	
	vec2 halfTexelSize = texelSize / 2.0;
	vec2 clampedOffsetCoords = clamp(offsetCoords, halfTexelSize, 1.0 - halfTexelSize);
	
	return texture2D(frame, clampedOffsetCoords).rgb;
}

void main(void) {
	vec2 uv = gl_FragCoord.xy / resolution.xy;
		
	vec2 offsetFromCenter = GetOffsetFromCenter(gl_FragCoord.xy, resolution.xy);
	vec2 offsetDirection = normalize(-offsetFromCenter);
	float offsetDistance = length(offsetFromCenter);
	
	vec2 offset = GetDistortionTexelOffset(offsetDirection, offsetDistance, time * 0.001);
	
	vec3 background = GetTextureOffset(uv, resolution.xy, offset);
	

	gl_FragColor = vec4(background, 1.0);
}
