import {
  createProgram,
  createTexture,
  u3fv,
  u1i,
  createBuffer,
  vec3,
  createFramebuffer,
  resize,
  copyFramebufferToTexture,
  u1f,
  download,
  sphericalToXYZ,
  loadShaders,
  createRandomTexture,
  createWebGL2Canvas,
  blitV3,
} from "./lib";

window.DEBUG = false;

const ShaderSources = [
  require("./shaders/buffer_0.glsl"),
  require("./shaders/buffer_1.glsl"),
  require("./shaders/buffer_2.glsl"),
] as string[];

init(
  ShaderSources,
  window.innerWidth * devicePixelRatio,
  window.innerHeight * devicePixelRatio
);

async function init(shaderSources: string[], width: number, height: number) {
  // Random texture setup
  const randomTex = createRandomTexture(fxrand);

  // GL context setup
  const { canvas: glc, context: gl } = createWebGL2Canvas(width, height);
  document.body.appendChild(glc);

  const buf = createBuffer(gl);
  const rTex = createTexture(gl, randomTex, 0);
  const iResolution = vec3(glc.width, glc.height, 1.0);

  const framebuffer = createFramebuffer(gl, width, height);

  const rtVert = require("./shaders/rt.vert.glsl");
  const blitFrag = require("./shaders/blit.frag.glsl");

  const blitProgram = createProgram(gl, rtVert, blitFrag);
  let programs = loadShaders(
    gl,
    rtVert,
    width,
    height,
    iResolution,
    shaderSources
  );

  resize(width, height, gl, framebuffer, programs, iResolution);

  gl.useProgram(blitProgram);
  u1i(gl, blitProgram, "blitTex", programs.length);

  let t = 0;
  let frame = 0;

  // Render loop setup

  let frameCount = 0;
  const params = new Float32Array(14 * 3);
  reseed();

  let continuousMode = false;

  function reseed() {
    frame = 0;

    // Reset params
    for (let i = 0; i <= params.length; i++) params[i] = fxrand();

    // Sphere radii
    params[0] = params[0] * 2 + 2;
    params[1] *= 2;
    params[2] *= 2;
    params[3] *= 2;
    params[4] *= 2;
    params[5] *= 2;

    // Sphere positions
    blitV3(params, 2, vec3(0));
    let r = params[0] + params[1] + params[3 * 3 + 1] * params[0];
    let θ = 2, ϕ = 1;
    blitV3(params, 3, sphericalToXYZ(r, ϕ, θ));
    (r = params[0] + params[2] + params[4 * 3 + 1] * params[0]), (θ = 3), (ϕ = 4);
    blitV3(params, 4, sphericalToXYZ(r, ϕ, θ));
    (r = params[0] + params[3] + params[5 * 3 + 1] * params[0]), (θ = 4), (ϕ = 5);
    blitV3(params, 5, sphericalToXYZ(r, ϕ, θ));
    (r = params[0] + params[4] + params[6 * 3 + 1] * params[0]), (θ = 5), (ϕ = 6);
    blitV3(params, 6, sphericalToXYZ(r, ϕ, θ));
    (r = params[0] + params[5] + params[7 * 3 + 1] * params[0]), (θ = 6), (ϕ = 7);
    blitV3(params, 7, sphericalToXYZ(r, ϕ, θ));

    frameCount = 100 + Math.floor(fxrand() * 100);
  }

  // Start render loop
  let tickRequested = true;
  tick();

  // Render function
  function draw(
    frame: number,
    frameCount: number,
    t: number,
    globalTime: number
  ) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer.framebuffer);

    if (frame === 0) {
      programs.forEach((p, i) => {
        gl.useProgram(p.program);
        copyFramebufferToTexture(gl, i + 1, width, height);
        u1i(gl, p.program, "frameCount", frameCount);
        u3fv(gl, p.program, "params", params);
      });
    }

    programs.forEach((p, i) => {
      gl.useProgram(p.program);
      u1f(gl, p.program, "iGlobalTime", globalTime);
      u1f(gl, p.program, "iTime", t);
      u1i(gl, p.program, "iFrame", frame);

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      copyFramebufferToTexture(gl, i + 1, width, height);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(blitProgram);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // Render loop
  function tick() {
    if (tickRequested) {
      tickRequested = false;

      const canvasBBox = document.body.getBoundingClientRect();
      const w = canvasBBox.width * devicePixelRatio;
      const h = canvasBBox.height * devicePixelRatio;
      if (w !== width || h !== height) {
        width = w;
        height = h;
        resize(width, height, gl, framebuffer, programs, iResolution);
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      if (continuousMode) document.body.classList.remove("rendering");
      else document.body.classList.add("rendering");

      draw(frame, frameCount, t, Date.now() / 1000);

      t += 16;
      frame++;

      frame = frame % frameCount;

      tickRequested = true;

      if (frame === 0) {
        tickRequested = false;
        document.body.classList.remove("rendering");
        if (continuousMode) {
          reseed();
          tickRequested = true;
        }
        if (isFxpreview) setTimeout(fxpreview, 300);
      }
    }
    requestAnimationFrame(tick);
  }

  glc.ondblclick = function (ev) {
    ev.preventDefault();
    reseed();
    document.body.classList.add("rendering");
    setTimeout(() => {
      tickRequested = true;
    }, 300);
  };

  window.onkeydown = function (ev) {
    if (ev.keyCode === 32) {
      reseed();
      continuousMode = !continuousMode;
      tickRequested = true;
    }
    if (ev.keyCode === 83) {
      glc.toBlob(
        (blob) => {
          if (!blob) throw new Error("Canvas toBlob failed");
          download(document.title + ".jpg", blob);
        },
        "image/jpeg",
        0.95
      );
    }
  };

  window.onresize = function (ev) {
    frame = 0;
    tickRequested = true;
  };
}
