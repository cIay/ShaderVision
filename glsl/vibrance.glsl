precision mediump float;

uniform vec2 resolution;
uniform sampler2D texture;

void main(void) {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  highp vec4 c = texture2D(texture, uv);

  float luminance = (c.r + c.g + c.b) / 3.0; 
  float saturation = (abs(c.r - luminance) + abs(c.g - luminance) + abs(c.b - luminance)) / 3.0 * (1.0 - luminance);

  float red = c.r;
  float green = c.g;
  float blue = c.b;

  red += (c.r - luminance) * 10.0 * saturation;
  green += (c.g - luminance) * 10.0 * saturation;
  blue += (c.b - luminance) * 10.0 * saturation;

  gl_FragColor = vec4(red, green, blue, c.a);
}