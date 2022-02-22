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

out vec4 fragColor;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    fragColor = texelFetch(iChannel2, ivec2(fragCoord), 0);
    fragColor = (1.0 - exp(-(fragColor / fragColor.a) * 2.0));
    fragColor.rgb = mix(vec3(dot(fragColor.rgb, vec3(0.2125, 0.7154, 0.0721))), fragColor.rgb, 2.0);
    fragColor.a = 1.0;
}

void main() {
    mainImage(fragColor, gl_FragCoord.xy);
}