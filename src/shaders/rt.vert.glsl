#version 300 es
precision highp float;

layout(std140, column_major) uniform;
layout(location = 0) in vec3 position;

void main() {
    gl_Position = vec4(position, 1.0);
}
