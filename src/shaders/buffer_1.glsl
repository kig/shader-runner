#version 300 es
precision highp float;

uniform sampler2D iChannel0; // Random texture
uniform sampler2D iChannel1; // Buffer A output
uniform sampler2D iChannel2; // Buffer B output
uniform sampler2D iChannel3; // Buffer C output

uniform vec3 iResolution;
uniform vec4 iMouse;
uniform float iGlobalTime;
uniform float iTime;
uniform int iFrame;
uniform int frameCount;

out vec4 fragColor;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec4 accum = texelFetch(iChannel2, ivec2(fragCoord), 0);
    vec4 lastLight = texelFetch(iChannel1, ivec2(fragCoord), 0);
    accum.rgb += lastLight.rgb;
    accum.a++;
    if(iFrame == 0) {
        fragColor = vec4(0);
    } else {
        fragColor = accum;
    }
}

void main() {
    mainImage(fragColor, gl_FragCoord.xy);
}