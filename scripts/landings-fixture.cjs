const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'apps/api/node_modules/typescript'));

function loadSource(relative, overrides = {}) {
  const filename = path.join(root, relative);
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    experimentalDecorators: true, esModuleInterop: true,
  } }).outputText;
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const nativeRequire = instance.require.bind(instance);
  instance.require = (name) => {
    if (name in overrides) return overrides[name];
    const local = path.resolve(path.dirname(filename), name + '.ts');
    if (name.startsWith('.') && fs.existsSync(local)) return loadSource(path.relative(root, local));
    return nativeRequire(name);
  };
  instance._compile(compiled, filename);
  return instance.exports;
}

const academic = loadSource('packages/shared/src/gestion-cultural-content.ts');
const shared = loadSource('packages/shared/src/index.ts', { './gestion-cultural-content': academic });
const renderer = loadSource('apps/api/src/modules/landings/landing-renderer.ts', { '@mali-one/shared': shared });
const { LandingsService } = loadSource('apps/api/src/modules/landings/landings.service.ts', { './landing-renderer': renderer });
const clone = (value) => JSON.parse(JSON.stringify(value));
const content = () => clone(shared.DEFAULT_GESTION_CULTURAL_LANDING_CONTENT);
const render = (document = content(), extra = {}) => renderer.renderLandingHtml({
  slug: 'gestion-cultural', name: 'Gestión Cultural', content: document,
  canonicalUrl: 'http://localhost/landing/gestion-cultural/', apiBase: 'http://localhost', ...extra,
});

module.exports = { root, shared, renderer, LandingsService, clone, content, render };
