#version 300 es
// https://www.shadertoy.com/view/Ms2SWW
// Created by inigo quilez - iq/2013
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

// Compare naive implementation of texture fetching to gradient-discontinuity-aware
// fetching. The naive approach produces a line of discontinuity in the left side
// of the screen, if the viewport resolution is an odd number. With this technique
// the artifact is gone.
//
// More info: http://www.iquilezles.org/www/articles/tunnel/tunnel.htm

precision mediump float;
out vec4 fragColor;

uniform vec2 resolution;
uniform sampler2D frame;
uniform float time;

// #define NAIVE_IMPLEMENTATION

void main(void)
{
    // normalized coordinates (-1 to 1 vertically)
    vec2 p = (-resolution.xy + 2.0*gl_FragCoord.xy)/resolution.y;

    // angle of each pixel to the center of the screen
    float a = atan(p.y,p.x) + time;

    #if 1
    // cylindrical tunnel
    float r = length(p);
    #else
    // squareish tunnel
    float r = pow( pow(p.x*p.x,4.0) + pow(p.y*p.y,4.0), 1.0/8.0 );
    #endif
    
    // index texture by (animated inverse) radious and angle
    vec2 uv = vec2( 0.3/r + 0.2*time, a/3.1415927 );

    #ifdef NAIVE_IMPLEMENTATION
        // naive fetch color
        vec3 col =  texture( frame, uv ).xyz;
	#else
        // fetch color with correct texture gradients, to prevent discontinutity
        vec2 uv2 = vec2( uv.x, atan(p.y,abs(p.x))/3.1415927 );
        vec3 col = textureGrad( frame, uv, dFdx(uv2), dFdy(uv2) ).xyz;
	#endif
    
    // darken at the center    
    col = col*r;
    
    fragColor = vec4( col, 1.0 );
}
