# Shader Runner

This is a small runner and build system for [ShaderToy](https://shadertoy.com)-style multibuffer shaders.
See [`src/shaders`](src/shaders/) for an example shader (the `buffer_x.glsl` -ones), see [`src/runner.ts`](src/runner.ts) for the runner script.

<img alt="Rainbow-colored sphere" src="static/shader_runner.jpg">
<small>Example shader output</small>

----

The [build script](build.js) uses [esbuild](https://github.com/evanw/esbuild), [spglsl](https://github.com/SalvatorePreviti/spglsl) and [html-minifier](https://github.com/kangax/html-minifier) to do fast builds (~1 second) and has a watch mode for creating dev builds on file changes (these run in <1s).

The build output is a single HTML file based on the template in [`static/index.html`](static/index.html). The build script inlines [`css/style.css`](css/style.css) and [`src/runner.ts`](src/runner.ts) into the HTML after compiling and minifying them. The resulting HTML is further minified with [html-minifier](https://github.com/kangax/html-minifier).

You can import shaders into `runner.ts` like below:

```typescript
const myVertexSource = require('./shaders/foo.vert.glsl');
const myFragmentSource = require('./shaders/foo.frag.glsl');
```

The shaders are minified and inlined to the compiled script as strings. The minifying step uses spglsl to compile the shaders in optimize mode, which does error checking and minification.

The HTML template and runner.ts use the [fxhash](https://fxhash.xyz) generative seed template for generating reproducible random outputs.

## Usage

```bash
# Install dependencies
yarn

# Start watch mode -- the generated files go to `watch/` and you can serve them with `serve watch`
yarn watch

# Do a build in `build/`. Test with `serve build`
yarn build
```

## License

MIT

Ilmari Heikkinen 2022