import { writeFileSync } from 'fs';
import { join } from 'path';
import type { Plugin } from 'vite';

type ViteChunkMetadata = {
  importedAssets?: Set<string>;
  importedCss?: Set<string>;
};

export function screenCastVersionPlugin(): Plugin {
  const buildId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    name: 'screen-cast-version',
    config(_config, { command }) {
      return {
        define: {
          __SCREEN_CAST_BUILD_ID__: JSON.stringify(
            command === 'build' ? buildId : 'dev',
          ),
        },
      };
    },
    generateBundle(_options, bundle) {
      const playerChunk = Object.values(bundle).find(
        (output) =>
          output.type === 'chunk' &&
          Object.keys(output.modules).some((id) =>
            id.replaceAll('\\', '/').endsWith(
              '/src/pages/screen-cast-player-page.tsx',
            ),
          ),
      );
      const assets = new Set<string>();
      const visitChunk = (fileName: string) => {
        const output = bundle[fileName];
        if (!output || output.type !== 'chunk' || assets.has(`/${fileName}`)) {
          return;
        }
        assets.add(`/${fileName}`);
        for (const imported of output.imports) visitChunk(imported);
        const metadata = (
          output as typeof output & { viteMetadata?: ViteChunkMetadata }
        ).viteMetadata;
        for (const css of metadata?.importedCss ?? []) assets.add(`/${css}`);
        for (const asset of metadata?.importedAssets ?? []) {
          assets.add(`/${asset}`);
        }
      };
      if (!playerChunk || playerChunk.type !== 'chunk') {
        this.error(
          'Screen Cast player chunk not found; offline asset manifest cannot be generated.',
        );
      }
      visitChunk(playerChunk.fileName);

      this.emitFile({
        type: 'asset',
        fileName: 'screen-cast-assets.json',
        source: `${JSON.stringify(
          {
            buildId,
            playerEntry: `/${playerChunk.fileName}`,
            assets: [...assets].sort(),
          },
          null,
          2,
        )}\n`,
      });
    },
    closeBundle() {
      const outDir = join(__dirname, '../dist');
      const payload = {
        buildId,
        builtAt: new Date().toISOString(),
      };
      writeFileSync(
        join(outDir, 'screen-cast-version.json'),
        `${JSON.stringify(payload, null, 2)}\n`,
      );
    },
  };
}
