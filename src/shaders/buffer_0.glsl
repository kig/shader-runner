#version 300 es
precision highp float;

uniform sampler2D iChannel0; // Random texture
uniform sampler2D iChannel1; // Buffer A output
uniform sampler2D iChannel2; // Buffer B output
uniform sampler2D iChannel3; // Buffer C output

uniform vec3 iResolution; // Resolution of the rendering canvas, used to calculate screen UVs.
uniform int iFrame; // Current frame of the animation.

uniform int frameCount; // Total frame count for the animation.

out vec4 fragColor; // Output color.


//// The shader starts here. Replace the stuff below.


// Parameters used for the scene, background and camera.
// Change the size and type to match your needs.
uniform vec3 params[14];


// SDF distance threshold. Increase for a speedup, decrease for less geometry banding.
#define THRESHOLD 0.001
// Maximum distance to trace the SDF rays.
#define MAX_DISTANCE 68.0

// How many steps should we take along the ray. Decrease for speedup.
#define RAY_STEPS 60
// How much antialiasing should we do per frame?
#define MAX_SAMPLES 1.0

// Struct for ray tracing rays.
// Think of this like an optical fiber. 
// There's light coming out of the end and as it gets further, it transmits less and less of the light it finds.
struct ray {
    vec3 p; // Ray origin
    vec3 d; // Ray direction

	// How much light the ray allows to pass at this point
    vec3 transmit; // *= material.transmit

	// How much light has passed through the ray
    vec3 light;    // += ray.transmit * material.emit
};

// Material struct.
// This is a very simple material model, so it's also fast.
struct mat {
    vec3 transmit; // How much of the incoming light the material allows to pass
    vec3 emit;     // How much light the material emits
    float diffuse; // How much to scatter the reflections
};

// Scene SDF function. The scene here is six spheres, positions and radii controlled by params.
float scene(vec3 p) {
    float s1 = length(p + params[2]) - params[0].x;
    float s2 = length(p + params[3]) - params[0].y;
    float s3 = length(p + params[4]) - params[0].z;
    float s4 = length(p + params[5]) - params[1].x;
    float s5 = length(p + params[6]) - params[1].y;
    float s6 = length(p + params[7]) - params[1].z;
    return min(min(min(min(min(s1, s2), s3), s4), s5), s6);
}

// Scene material function. Returns the material for the point p.
mat material(vec3 p) {
    mat m;
    m.transmit = params[9] + (1.0-params[9])*mod(p, vec3(1.0));
    m.emit = mod(p, vec3(1.0)) * vec3((abs(mod(p.y*p.x*p.z*0.5, 1.0))));
    m.diffuse = 0.2 + 0.8*params[8].z;
    return m;
}

// Scene normal function. Computes a numerical normal at the ray origin with d as the derivative offset.
vec3 normal(ray r, float d) {
    float e = 0.001;
    float dx = scene(vec3(e, 0.0, 0.0) + r.p) - d;
    float dy = scene(vec3(0.0, e, 0.0) + r.p) - d;
    float dz = scene(vec3(0.0, 0.0, e) + r.p) - d;
    return normalize(vec3(dx, dy, dz));
}

// Background color function.
vec3 shadeBg(vec3 nml, float t) {
    return vec3(0.0);
}

// Shading the rays. Very simple, add emission to ray's light, multiply ray's transmit by material transmit.
float shade(inout ray r, vec3 nml, float d) {
    mat m = material(r.p);
    r.light += m.emit * r.transmit;
    r.transmit *= m.transmit;
    return m.diffuse;
}

// Generate pseudorandom numbers for diffuse bounce offset
vec2 hash2f(float n) {
    return fract(sin(vec2(n, n + 1.0)) * vec2(43758.5453123, 22578.1459123));
}

// Offset the ray randomly by material diffuse. Higher the diffuse, more random the bounce vector.
void offset(inout vec3 nml, float k, float count, float diffuse) {
    vec3 uu = normalize(cross(nml, vec3(0.01, 1.0, 1.0)));
    vec3 vv = normalize(cross(uu, nml));
    vec2 aa = hash2f(count);
    float ra = sqrt(aa.y);
    float rx = ra * cos(6.2831 * aa.x);
    float ry = ra * sin(6.2831 * aa.x);
    float rz = sqrt(sqrt(k) * (1.0 - aa.y));
    vec3 rr = vec3(rx * uu + ry * vv + rz * nml);
    nml = normalize(mix(nml, rr, diffuse));
}

// Camera XY rotation matrix.
mat3 rotationXY(vec2 angle) {
    float cp = cos(angle.x);
    float sp = sin(angle.x);
    float cy = cos(angle.y);
    float sy = sin(angle.y);

    return mat3(cy, 0.0, -sy, sy * sp, cp, cy * sp, sy * cp, -sp, cy * cp);
}

// Set up ray for the camera, sample number, time, and screen UV.
ray setupRay(vec2 uv, float k, float t) {
    mat3 rot = rotationXY(sign(0.5 - params[11].yz) * 1.5 * (0.15 + params[11].x) * t);
    ray r;
    r.light = vec3(0.0);
    r.transmit = vec3(1.0);
    r.p = rot * (vec3(uv * -1.0, -9.0 - 3.0 * pow(params[12].y, 1.5)));
    r.d = rot * normalize(vec3(uv, 1.0));
    vec3 rvec = (params[13] - 0.5);
    r.p += vec3(0.01, 0.01, 0.01) * sign(rvec) * pow(2.0 * rvec, vec3(2.0));

    return r;
}

// Trace rays through the scene.
vec3 trace(vec2 fragCoord, vec2 uv, vec2 uvD, inout float rayNumber) {
    float minDist = 9999999.0;
    float count = 0.0;
    float diffuseSum = 0.0, maxDiffuseSum = 0.0;

    vec3 accum = vec3(0.0);

    float time = float(iFrame % frameCount) / 60.0;

    vec2 rc = fragCoord + (5.0 + mod(time, 1.73728)) * vec2(rayNumber * 37.0, rayNumber * 63.0);
    vec4 rand = texelFetch(iChannel0, ivec2(mod(rc, vec2(256.0))), 0);

    float shutterSpeed = 0.1;

    float t = time + shutterSpeed * rand.x;

    float k = 1.0;
    ray r = setupRay(uv + (uvD * vec2(rand.x, rand.y)), k + rayNumber, t);

    vec3 sun = vec3(5.0, 3.5, 2.0) * 4.0;

    for(int i = 0; i < RAY_STEPS; i++) {
        if(k > MAX_SAMPLES)
            break;
        float dist = scene(r.p);
        minDist = min(minDist, dist);
        r.p += dist * r.d;
        if(dist < THRESHOLD) {
            r.p -= dist * r.d;
            vec3 nml = normal(r, dist);
            float diffuse = shade(r, nml, dist);
            diffuseSum += diffuse;
            offset(r.d, rayNumber + k, rand.x + rayNumber + k + 10.0 * dot(nml, r.d), diffuse * 0.5);
            r.d = reflect(r.d, nml);
            r.p += 4.0 * THRESHOLD * r.d;
            count++;
            rand = rand.yzwx;

            if(dot(r.transmit, sun) < 1.0) {
                accum += r.light;
                k++;
                t = time + shutterSpeed * rand.x;
                r = setupRay(uv + (uvD * vec2(rand.x, rand.y)), k, t);
                maxDiffuseSum = max(diffuseSum, maxDiffuseSum);
                diffuseSum = 0.0;
            }
        } else if(dist > MAX_DISTANCE) {
            vec3 bg = shadeBg(-r.d, t);
            if(minDist > THRESHOLD * 1.5) {
                r.light = bg;
                break;
            }
            accum += r.light + r.transmit * bg;
            k++;
            t = time + shutterSpeed * rand.x;
            r = setupRay(uv + (uvD * vec2(rand.x, rand.y)), k, t);
            maxDiffuseSum = max(diffuseSum, maxDiffuseSum);
            diffuseSum = 0.0;
        }
    }
    rayNumber += k;
    accum += r.light;
    return accum / k;
}

// Turn screen coords to screen UVs, trace rays for the current UV, add the light to the current pixel.
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float rayNumber = texelFetch(iChannel1, ivec2(fragCoord), 0).a;
    vec2 aspect = vec2(iResolution.x / iResolution.y, 1.0);
    vec2 uv = fragCoord.xy / iResolution.xy;
    uv = (2.0 * uv - 1.0) * aspect;

    vec2 uvD = ((2.0 * ((fragCoord.xy + vec2(1.0, 1.0)) / iResolution.xy) - 1.0) * aspect) - uv;

    vec3 light = trace(fragCoord, uv, uvD, rayNumber) + texelFetch(iChannel0, ivec2(fragCoord) % 256, 0).rgb * 0.01;

    fragColor = vec4(light, rayNumber + 1.0);
}

// Run mainImage.
void main() {
    mainImage(fragColor, gl_FragCoord.xy);
}