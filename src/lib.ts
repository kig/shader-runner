const {
  ARRAY_BUFFER,
  COLOR_ATTACHMENT0,
  COLOR_BUFFER_BIT,
  COMPILE_STATUS,
  DEPTH_ATTACHMENT,
  DEPTH_BUFFER_BIT,
  DEPTH_COMPONENT32F,
  FLOAT,
  FRAGMENT_SHADER,
  FRAMEBUFFER,
  LINEAR,
  LINEAR_MIPMAP_LINEAR,
  NEAREST,
  RENDERBUFFER,
  REPEAT,
  RGBA,
  RGBA32F,
  STATIC_DRAW,
  TEXTURE_2D,
  TEXTURE_MAG_FILTER,
  TEXTURE_MIN_FILTER,
  TEXTURE_WRAP_S,
  TEXTURE_WRAP_T,
  TEXTURE0,
  UNPACK_FLIP_Y_WEBGL,
  UNSIGNED_BYTE,
  VERTEX_SHADER,
} = WebGL2RenderingContext;

export function createWebGL2Canvas(
  width: number,
  height: number
): { canvas: HTMLCanvasElement; context: WebGL2RenderingContext } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const glContext = canvas.getContext("webgl2", {
    antialias: false,
    preserveDrawingBuffer: true,
    alpha: false,
  });
  if (!glContext) throw new Error("Could not create WebGL2 context");
  const context = glContext;
  var extC = context.getExtension("EXT_color_buffer_float");
  var extF = context.getExtension("OES_texture_float");
  return { canvas, context };
}

export function createRandomTexture(rng: () => number): PixelBuffer {
  const data = new Uint8Array(256 * 256 * 4);
  const randomTex:PixelBuffer = {data, type: 'u8',
    width: 256,
    height: 256,
  };
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const off = (y * 256 + x) | 0;
      const off2 = (((y + 17) % 256) * 256 + ((x + 37) % 256)) | 0;
      const v = (256 * rng()) | 0;
      data[off * 4] = data[off2 * 4 + 1] = v;
      data[off * 4 + 2] = (256 * rng()) | 0;
      data[off * 4 + 3] = (256 * rng()) | 0;
    }
  }
  return randomTex;
}

export function loadShaders(
  gl: WebGL2RenderingContext,
  rtVert: string,
  width: number,
  height: number,
  iResolution: Float32Array,
  shaderSources: string[]
) {
  const programs = shaderSources.map((shaderSrc, i) => {
    const pixelBuffer: PixelBuffer = { data: null, type: 'f32', width, height };

    const program = createProgram(gl, rtVert, shaderSrc);
    const texture = createTexture(gl, pixelBuffer, i + 1);

    gl.useProgram(program);

    u3fv(gl, program, "iResolution", iResolution);
    u1i(gl, program, "iChannel0", 0);
    u1i(gl, program, "iChannel1", 1);
    u1i(gl, program, "iChannel2", 2);
    u1i(gl, program, "iChannel3", 3);
    u1i(gl, program, "iChannel4", 4);
    const pos = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, 0, 0);

    const p = { program, pixelBuffer, texture };

    return p;
  });
  return programs;
}

export function resize(
  w: number,
  h: number,
  gl: WebGL2RenderingContext,
  framebuffer: ShaderFramebuffer,
  programs: ShaderProgram[],
  iResolution: Float32Array
) {
  gl.canvas.width = w;
  gl.canvas.height = h;
  iResolution[0] = w;
  iResolution[1] = h;
  gl.viewport(0, 0, w, h);
  programs.forEach((p: ShaderProgram, i: number) => {
    gl.useProgram(p.program);
    u3fv(gl, p.program, "iResolution", iResolution);
    p.pixelBuffer.width = w;
    p.pixelBuffer.height = h;
    resizeTexture(gl, p.texture, p.pixelBuffer, i + 1);
  });
  resizeFramebuffer(gl, framebuffer, w, h);
  gl.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT);
  framebuffer.width = w;
  framebuffer.height = h;
}

export function copyFramebufferToTexture(
  gl: WebGL2RenderingContext,
  unit: number,
  width: number,
  height: number
) {
  gl.activeTexture(TEXTURE0 + unit);
  gl.copyTexImage2D(TEXTURE_2D, 0, RGBA32F, 0, 0, width, height, 0);
}

export function resizeFramebuffer(
  gl: WebGL2RenderingContext,
  fb: ShaderFramebuffer,
  width: number,
  height: number
) {
  const { framebuffer, renderbufferDepth, renderbufferColor } = fb;
  gl.bindFramebuffer(FRAMEBUFFER, framebuffer);

  gl.bindRenderbuffer(RENDERBUFFER, renderbufferDepth);
  gl.renderbufferStorage(RENDERBUFFER, DEPTH_COMPONENT32F, width, height);

  gl.bindRenderbuffer(RENDERBUFFER, renderbufferColor);
  gl.renderbufferStorage(RENDERBUFFER, RGBA32F, width, height);

  gl.clear(DEPTH_BUFFER_BIT | COLOR_BUFFER_BIT);

  gl.bindRenderbuffer(RENDERBUFFER, null);
  gl.bindFramebuffer(FRAMEBUFFER, null);
  return { ...fb, width, height };
}

export function createFramebuffer(
  gl: WebGL2RenderingContext,
  width: number,
  height: number
): ShaderFramebuffer {
  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) throw new Error("Unable to create framebuffer");
  gl.bindFramebuffer(FRAMEBUFFER, framebuffer);

  const renderbufferDepth = gl.createRenderbuffer();
  if (!renderbufferDepth) throw new Error("Unable to create renderbufferDepth");
  gl.bindRenderbuffer(RENDERBUFFER, renderbufferDepth);
  gl.renderbufferStorage(RENDERBUFFER, DEPTH_COMPONENT32F, width, height);
  gl.framebufferRenderbuffer(
    FRAMEBUFFER,
    DEPTH_ATTACHMENT,
    RENDERBUFFER,
    renderbufferDepth
  );

  const renderbufferColor = gl.createRenderbuffer();
  if (!renderbufferColor) throw new Error("Unable to create renderbufferColor");
  gl.bindRenderbuffer(RENDERBUFFER, renderbufferColor);
  gl.renderbufferStorage(RENDERBUFFER, RGBA32F, width, height);
  gl.framebufferRenderbuffer(
    FRAMEBUFFER,
    COLOR_ATTACHMENT0,
    RENDERBUFFER,
    renderbufferColor
  );

  gl.bindRenderbuffer(RENDERBUFFER, null);
  gl.bindFramebuffer(FRAMEBUFFER, null);
  return { framebuffer, renderbufferDepth, renderbufferColor, width, height };
}

export function resizeTexture(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture,
  buf: PixelBuffer,
  unit: number
) {
  gl.activeTexture(TEXTURE0 + (unit || 0));
  gl.bindTexture(TEXTURE_2D, tex);
  gl.pixelStorei(UNPACK_FLIP_Y_WEBGL, false);
  if (buf.type === 'f32') {
    gl.texImage2D(
      TEXTURE_2D,
      0,
      RGBA32F,
      buf.width,
      buf.height,
      0,
      RGBA,
      FLOAT,
      buf.data
    );
    gl.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    gl.texParameteri(TEXTURE_2D, TEXTURE_WRAP_S, REPEAT);
    gl.texParameteri(TEXTURE_2D, TEXTURE_WRAP_T, REPEAT);
  } else {
    gl.texImage2D(
      TEXTURE_2D,
      0,
      RGBA,
      buf.width,
      buf.height,
      0,
      RGBA,
      UNSIGNED_BYTE,
      buf.data
    );
    gl.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, LINEAR);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(TEXTURE_2D, TEXTURE_WRAP_S, REPEAT);
    gl.texParameteri(TEXTURE_2D, TEXTURE_WRAP_T, REPEAT);
    gl.generateMipmap(TEXTURE_2D);
  }
}

export function createTexture(
  gl: WebGL2RenderingContext,
  buf: PixelBuffer,
  unit: number
) {
  const tex = gl.createTexture();
  if (!tex) throw new Error("Unable to create texture");
  resizeTexture(gl, tex, buf, unit);
  return tex;
}
export function updateTexture(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture,
  buf: PixelBuffer,
  unit: number
) {
  gl.activeTexture(TEXTURE0 + (unit || 0));
  gl.bindTexture(TEXTURE_2D, tex);
  if (buf.type === 'f32') {
    gl.texImage2D(
      TEXTURE_2D,
      0,
      RGBA,
      buf.width,
      buf.height,
      0,
      RGBA,
      FLOAT,
      buf.data
    );
  } else {
    gl.texImage2D(
      TEXTURE_2D,
      0,
      RGBA,
      buf.width,
      buf.height,
      0,
      RGBA,
      UNSIGNED_BYTE,
      buf.data
    );
  }
}
export function createBuffer(gl: WebGL2RenderingContext) {
  var buf = gl.createBuffer();
  gl.bindBuffer(ARRAY_BUFFER, buf);
  var arr = new Float32Array([
    -1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0,
  ]);
  gl.bufferData(ARRAY_BUFFER, arr, STATIC_DRAW);
  return buf;
}
export function createShader(
  gl: WebGL2RenderingContext,
  source: string | WebGLShader,
  type: number
) {
  var s = source;
  if (typeof source === "string") {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Unable to create shader");
    s = shader;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) || "No shader info log");
    }
  }
  return s;
}
export function createProgram(
  gl: WebGL2RenderingContext,
  vert: WebGLShader | string,
  frag: WebGLShader | string
) {
  var t0 = Date.now();
  var p = gl.createProgram();
  if (!p) throw new Error("Failed to create program");
  var vs = createShader(gl, vert, VERTEX_SHADER);
  var fs = createShader(gl, frag, FRAGMENT_SHADER);
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (DEBUG) console.log("Create program: " + (Date.now() - t0) + " ms");
  return p;
}
export function getUniform(
  gl: WebGL2RenderingContext,
  p: WebGLProgramWithUniforms,
  name: string
): WebGLUniformLocation | null {
  if (!p.uniforms) p.uniforms = {};
  if (!p.uniforms[name]) p.uniforms[name] = gl.getUniformLocation(p, name);
  return p.uniforms[name];
}
export function u4fv(
  gl: WebGL2RenderingContext,
  p: WebGLProgramWithUniforms,
  name: string,
  v: Float32Array
) {
  gl.uniform4fv(getUniform(gl, p, name), v);
}
export function u4f(
  gl: WebGL2RenderingContext,
  p: WebGLProgramWithUniforms,
  name: string,
  x: number,
  y: number,
  z: number,
  w: number
) {
  gl.uniform4f(getUniform(gl, p, name), x, y, z, w);
}
export function u3fv(
  gl: WebGL2RenderingContext,
  p: WebGLProgramWithUniforms,
  name: string,
  v: Float32Array
) {
  gl.uniform3fv(getUniform(gl, p, name), v);
}
export function u3f(
  gl: WebGL2RenderingContext,
  p: WebGLProgramWithUniforms,
  name: string,
  x: number,
  y: number,
  z: number
) {
  gl.uniform3f(getUniform(gl, p, name), x, y, z);
}
export function u2fv(
  gl: WebGL2RenderingContext,
  p: WebGLProgramWithUniforms,
  name: string,
  v: Float32Array
) {
  gl.uniform2fv(getUniform(gl, p, name), v);
}
export function u2f(
  gl: WebGL2RenderingContext,
  p: WebGLProgramWithUniforms,
  name: string,
  x: number,
  y: number
) {
  gl.uniform2f(getUniform(gl, p, name), x, y);
}
export function u1fv(
  gl: WebGL2RenderingContext,
  p: WebGLProgramWithUniforms,
  name: string,
  v: Float32Array
) {
  gl.uniform1fv(getUniform(gl, p, name), v);
}
export function u1f(
  gl: WebGL2RenderingContext,
  p: WebGLProgramWithUniforms,
  name: string,
  x: number
) {
  gl.uniform1f(getUniform(gl, p, name), x);
}
export function u1i(
  gl: WebGL2RenderingContext,
  p: WebGLProgramWithUniforms,
  name: string,
  x: number
) {
  gl.uniform1i(getUniform(gl, p, name), x);
}

export function blitV3(
  array: Float32Array,
  index: number,
  v3: number[] | Float32Array
) {
  array[index * 3 + 0] = v3[0];
  array[index * 3 + 1] = v3[1];
  array[index * 3 + 2] = v3[2];
}

export function vec3(x: number = 0, y: number = x, z: number = y) {
  var v = new Float32Array(3);
  v[0] = x;
  v[1] = y;
  v[2] = z;
  return v;
}
export function dot(u: Float32Array, v: Float32Array) {
  return u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
}
export function sub(u: Float32Array, v: Float32Array, d: Float32Array) {
  d[0] = u[0] - v[0];
  d[1] = u[1] - v[1];
  d[2] = u[2] - v[2];
  return d;
}
export function normalize(v: Float32Array) {
  var ilen = 1 / Math.sqrt(dot(v, v));
  v[0] *= ilen;
  v[1] *= ilen;
  v[2] *= ilen;
  return v;
}
export function cross(u: Float32Array, v: Float32Array, d: Float32Array) {
  d[0] = u[1] * v[2] - u[2] * v[1];
  d[1] = u[2] * v[0] - u[0] * v[2];
  d[2] = u[0] * v[1] - u[1] * v[0];
  return d;
}

const rc = vec3(0.0);
export function raySphere(
  ro: Float32Array,
  rd: Float32Array,
  cen: Float32Array,
  r: number,
  idx: number,
  hit: { dist: number; pick: number }
) {
  sub(ro, cen, rc);
  var c = dot(rc, rc);
  c -= r * r;
  var b = dot(rd, rc);
  var d = b * b - c;
  var t = -b - Math.sqrt(Math.abs(d));
  if (t > 0 && d > 0 && t < hit.dist) {
    hit.dist = t;
    hit.pick = idx;
  }
}
const traceTmp = vec3(0.0);
export function trace(
  ro: Float32Array,
  rd: Float32Array,
  posTex: Float32Array
) {
  var hit = {
    dist: 1e7,
    pick: -2,
  };
  for (var i = 0; i < 9; i++) {
    var off = i * 4;
    traceTmp[0] = posTex[off];
    traceTmp[1] = posTex[off + 1];
    traceTmp[2] = posTex[off + 2];
    var r = posTex[off + 3];
    raySphere(ro, rd, traceTmp, r, i, hit);
  }
  return hit;
}

const up = vec3(0.0, 1.0, 0.0);
const uvd = vec3(0.0);
const xaxis = vec3(0.0),
  yaxis = vec3(0.0),
  zaxis = vec3(0.0);
export function getDir(
  iResolution: Float32Array,
  cameraPos: Float32Array,
  cameraTarget: Float32Array,
  fragCoord: Float32Array,
  dir: Float32Array
) {
  uvd[0] =
    (-1.0 + (2.0 * fragCoord[0]) / iResolution[0]) *
    (iResolution[0] / iResolution[1]);
  uvd[1] = -1.0 + (2.0 * fragCoord[1]) / iResolution[1];
  uvd[2] = 1.0;
  normalize(uvd);
  normalize(sub(cameraTarget, cameraPos, zaxis));
  normalize(cross(up, zaxis, xaxis));
  normalize(cross(zaxis, xaxis, yaxis));
  dir[0] = dot(vec3(xaxis[0], yaxis[0], zaxis[0]), uvd);
  dir[1] = dot(vec3(xaxis[1], yaxis[1], zaxis[1]), uvd);
  dir[2] = dot(vec3(xaxis[2], yaxis[2], zaxis[2]), uvd);
  return dir;
}

export function sphericalToXYZ(r: number, ϕ: number, θ: number): Float32Array {
  return vec3(
    r * Math.sin(ϕ) * Math.cos(θ),
    r * Math.sin(ϕ) * Math.sin(θ),
    r * Math.cos(ϕ)
  );
}

export function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

export function hslToRgb(h: number, s: number, l: number): number[] {
  var r, g, b;

  if (s == 0) {
    r = g = b = l; // achromatic
  } else {
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [r, g, b];
}

export function cssHSLtoRGB(cssHSL: string): number[] {
  const c = cssHSL
    .replace(/[^0-9,\.-]/g, "")
    .split(",")
    .map((c: string) => parseFloat(c));
  c[0] %= 360;
  if (c[0] < 0) c[0] += 360;
  c[1] = Math.min(100, Math.max(0, c[1]));
  c[2] = Math.min(100, Math.max(0, c[2]));
  return hslToRgb(c[0] / 360, c[1] / 100, c[2] / 100);
}

export function coolWarm(seed: number, index: number): string {
  seed = seed % 90;
  if (index === 1) return `hsl(${seed % 360}, 80%, 45%)`;
  if (index === 3) return `hsl(${(160 + seed) % 360}, 10%, 50%)`;
  if (index === 4) return `hsl(${(seed + 30) % 360}, 90%, 90%)`;
  if (index === 0) return `hsl(${seed + (10 % 360)}, 90%, 10%)`;
  return `hsl(${(seed + 180) % 360}, 70%, 45%)`;
}

export function oilPaint(seed: number, index: number): string {
  if (index === 1) return `hsl(${seed % 240}, 80%, 45%)`;
  if (index === 3) return `hsl(${(160 + 8418839 * seed) % 360}, 10%, 50%)`;
  if (index === 4) return `hsl(${((seed % 39) + 30) % 360}, 90%, 95%)`;
  if (index === 0) return `hsl(${seed % 30}, 90%, 10%)`;
  return `hsl(${(seed + 180) % 240}, 70%, 45%)`;
}

export function highlight(seed: number, index: number): string {
  if (index === 4) return `hsl(${(seed * 471721) % 360}, 100%, 55%)`;
  return `hsl(${170 + (((seed + index) * 20) % 360)}, ${
    5 + 5 * ((seed + index) % 10)
  }%, ${((seed + index) % 10) * 5 + 30}%)`;
}

export function highkey(seed: any, index: number): string {
  return `hsl(${((seed + index) * 30) % 360}, ${10 + 10 * index}%, ${
    ((seed + index) % 10) * 3.5 + 60
  }%)`;
}

export function lowkey(seed: any, index: number): string {
  return `hsl(${((seed + index) * 30) % 360}, ${15 + 5 * index}%, ${
    ((seed + index) % 10) * 5 + 20
  }%)`;
}

export function muted(seed: number, index: number): string {
  seed = seed % 90;
  if (index === 1) return `hsl(${seed % 360}, 30%, 45%)`;
  if (index === 3) return `hsl(${(160 + seed) % 360}, 10%, 50%)`;
  if (index === 4) return `hsl(${(seed + 30) % 360}, 30%, 70%)`;
  if (index === 0) return `hsl(${seed - (20 % 360)}, 20%, 30%)`;
  return `hsl(${(seed + 140) % 360}, 30%, 45%)`;
}

export function rainbow(seed: number, index: number): string {
  return `hsl(${(seed + index * 40) % 360}, ${70 + 5 * index}%, ${
    35 + 5 * index
  }%)`;
}

export function paletteColor(seed: number, index: number): string {
  const s = Math.abs(seed * 10000) % 10000;
  if (s < 1000) return coolWarm(seed, index);
  if (s < 2000)
    return `hsl(${seed + (((index / 10) * 180) % 360)}, ${15 + 15 * index}%, ${
      (seed * 109481 + index * 189231) % 100
    }%)`;
  if (s < 3000)
    return `hsl(${seed + ((Math.floor(index / 2) * 180) % 360)}, ${
      10 + 40 * (index % 2)
    }%, 50%)`;
  if (s < 4000)
    return `hsl(${(seed + index * 10) % 360}, ${50 + 10 * index}%, ${
      30 + 5 * index + (seed % 50)
    }%)`;
  if (s < 5000) return oilPaint(seed, index);
  if (s < 6000) return highlight(seed, index);
  if (s < 7000) return highkey(seed, index);
  if (s < 8000) return lowkey(seed, index);
  if (s < 9000) return muted(seed, index);
  return rainbow(seed, index);
}

export function createPalette(seed: number, n: number): number[][] {
  const colors = [];
  for (let i = 0; i < n; i++) {
    const color = paletteColor(seed, i);
    colors.push(cssHSLtoRGB(color));
  }
  return colors;
}

export function download(filename: string, blob: string | Blob): void {
  const a = document.createElement("a");
  a.download = filename;
  a.href = typeof blob === "string" ? blob : URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
}
