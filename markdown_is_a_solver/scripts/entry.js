// Bundle entry for z3-solver's browser build.
//
// The stock browser.js `init()` ignores module overrides — `locateFile` and
// `mainScriptUrlOrBlob` never reach emscripten. We thread the overrides
// through the factory ourselves.
//
// The caller MUST pass `mainScriptUrlOrBlob` pointing at this bundle's URL:
// emscripten spawns pthread workers with `new Worker(mainScriptUrlOrBlob)`
// and the default (`document.currentScript?.src`) is null in an ES-module
// context.

import initZ3Factory from 'z3-solver/build/z3-built.js';
import { init as lowLevelInit } from 'z3-solver/build/low-level/wrapper.__GENERATED__.js';
import { createApi } from 'z3-solver/build/high-level/high-level.js';

export async function init(moduleOverrides) {
  const factory = () => initZ3Factory(moduleOverrides);
  const lowLevel = await lowLevelInit(factory);
  const highLevel = createApi(lowLevel.Z3);
  return { ...lowLevel, ...highLevel };
}
