import { writeFileSync } from 'fs';
import { join } from 'path';
import type { Plugin } from 'vite';

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
