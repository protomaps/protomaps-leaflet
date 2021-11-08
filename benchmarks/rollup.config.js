import replace from "@rollup/plugin-replace";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import buble from "@rollup/plugin-buble";
import alias from "@rollup/plugin-alias";

const replaceConfig = {
  preventAssignment: true,
  "process.env.BENCHMARK_VERSION": JSON.stringify(
    process.env.BENCHMARK_VERSION
  ),
  "process.env.NODE_ENV": JSON.stringify("production"),
};

const viewConfig = {
  input: "dist/benchmarks.js",
  output: {
    file: "dist/index.js",
    format: "umd",
    name: "bench",
    indent: false,
    sourcemap: true,
  },
  plugins: [
    alias({
      entries: [
        { find: "protomaps-local", replacement: "../dist/index.js" },
        {
          find: "protomaps",
          // With modeResolution mode set to Node in
          // tsconfig, the default entry point is
          // dist/protomaps.module.js which seems it's not working
          // TODO: Investigate
          replacement: "./node_modules/protomaps/dist/index.js",
        },
      ],
    }),
    buble({
      transforms: { dangerousForOf: true, generator: false, asyncAwait: false },
      objectAssign: true,
      // Buble crashes on pmtiles/index.mjs
      // TODO: Investigate
      exclude: ["../node_modules/pmtiles/index.mjs"],
    }),
    resolve({
      browser: true,
      preferBuiltins: false,
    }),
    commonjs(),
    replace(replaceConfig),
  ],
};

export default viewConfig;
