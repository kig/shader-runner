declare module "*.glsl";

declare var DEBUG: boolean;
declare var isFxpreview: boolean;
declare function fxrand(): number;
declare function fxpreview(): number;
declare var $fxhashFeatures: {
  [featureName: string]: string | number | boolean;
};
declare function require(string): string;

interface PixelBuffer {
  data: ArrayBufferView | null,
  type: 'f32' | 'u8' | undefined,
  width: number;
  height: number;
}

type ShaderProgram = {
  program: WebGLProgramWithUniforms;
  pixelBuffer: PixelBuffer;
  texture: WebGLTexture;
};

interface WebGLProgramWithUniforms extends WebGLProgram {
  uniforms?: { [uniformName: string]: WebGLUniformLocation | null };
}

type ShaderFramebuffer = {
  framebuffer: WebGLFramebuffer;
  renderbufferDepth: WebGLRenderbuffer;
  renderbufferColor: WebGLRenderbuffer;
  width: number;
  height: number;
};
