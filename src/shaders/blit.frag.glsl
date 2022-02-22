#version 300 es
precision highp float;

uniform sampler2D blitTex;

out vec4 fragColor;

void main() {
    fragColor = texelFetch(blitTex, ivec2(gl_FragCoord.xy), 0);
}
