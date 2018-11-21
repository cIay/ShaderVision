#version 300 es

precision mediump float;
out vec4 fragColor;

uniform vec2 resolution;
uniform sampler2D frame;
uniform float time;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0); 
}
vec3 taylorInvSqrt(vec3 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}
float snoise(vec2 P) {
  vec2 C = vec2 (0.211324865405187134,  // (3.0 - sqrt(3.0)) / 6.0
                   0.366025403784438597); // 0.5 * (sqrt(3.0) - 1.0)
  // First corner
  vec2 i = floor (P + dot(P, C.yy));
  vec2 x0 = P - i + dot (i, C.xx);
  // Other corners
  vec2 i1;
  i1.x = step (x0.y, x0.x); // 1.0 if x0.x > x0.y, else 0.0
  i1.y = 1.0 - i1.x;
  //x1 = x0 - i1 + 1.0 * C.xx; x2 = x0 - 1.0 + 2.0 * C.xx;
  vec4 x12 = vec4(x0.xy, x0.xy) + vec4(C.xx, C.xx * 2.0 - 1.0);
  x12.xy -= i1;
  // Permutations
  i = mod(i, 289.0); // Avoid truncation in polynomial evaluation
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  // Circularly symmetric blending kernel
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), vec3(0.0));
  m = m*m;
  m = m*m;
  // Gradients from 41 points on a line, mapped onto a diamond
  vec3 x = fract(p * (1.0 / 41.0)) * 2.0 - 1.0;
  vec3 gy = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5); // round (x) is a GLSL 1.30 feature
  vec3 gx = x - ox;
  // Normalise gradients implicitly by scaling m
  m *= taylorInvSqrt(gx*gx + gy*gy);
  // Compute final noise value at P
  vec3 g;
  g.x = gx.x * x0.x + gy.x * x0.y;
  g.yz = gx.yz * x12.xz + gy.yz * x12.yw;
  // Scale output to span range [-1 ,1] (scaling factor determined by experiments)
  return 130.0 * dot(m, g);
}

float fbm(vec2 st) {
  float val = 0.0;
  float freq = 1.0;
  float amp = 0.4;
  const int octaves = 5;
  for(int i = 0; i < octaves; i++) {
    val += (snoise(st * freq)) * amp + (amp/freq);
    freq *= 2.0; // lacunarity
    amp *= 0.5; // gain
  }
  return val;
}

vec3 pattern(vec2 p, float t, float luminance) {
  vec2 q = vec2(fbm(p + vec2(0.0, 0.0)), fbm(p*sin(t + luminance)  + vec2(5.2, 1.3)));
  vec2 r = vec2(fbm(p + 4.0*q + vec2(1.7,9.2)), fbm(p + 4.0*q*cos(t + luminance) + vec2(8.3,2.8)));
  float f = fbm(p + 4.0*r);
  vec3 p_out = vec3((r.x*r.y), (mix(q.y,r.y,f)), r.y);
  return p_out;
}

void main(void) {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 c = texture(frame, uv);

  fragColor = vec4((pattern(uv, time*0.05, (c.r + c.g + c.b) / 3.0)), 1.0);
}