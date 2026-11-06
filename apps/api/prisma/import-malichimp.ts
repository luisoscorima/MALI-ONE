import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  applyMalichimpFiles,
  inspectMalichimpFiles,
  locateMalichimpFiles,
} from '../src/modules/malichimp/lib/malichimp-import-runner';

const prisma = new PrismaClient();

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  if (!option('--dir')) {
    throw new Error('Uso: --dir /ruta/al/export [--apply] [--batch-size 1000]');
  }
  const directory = path.resolve(option('--dir')!);
  const apply = process.argv.includes('--apply');
  const batchSize = Math.max(
    100,
    Math.min(2_000, Number(option('--batch-size') ?? 1_000)),
  );
  const files = await locateMalichimpFiles(directory);
  const report = await inspectMalichimpFiles(files);
  console.log(
    JSON.stringify({ mode: apply ? 'apply' : 'dry-run', ...report }, null, 2),
  );
  if (report.errors.length) {
    throw new Error(`Importación cancelada: ${report.errors.length} error(es)`);
  }
  if (!apply) return;

  const result = await applyMalichimpFiles(prisma, files, report, {
    sourceKey: option('--source-key') ?? path.basename(directory),
    sourceDirectory: directory,
    batchSize,
    onProgress: (processed, total) => {
      if (processed % 5_000 < batchSize) {
        console.log(`Procesados: ${processed}/${total}`);
      }
    },
  });
  const [statuses, tags, suppressions] = await Promise.all([
    prisma.malichimpContact.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.malichimpTag.count(),
    prisma.malichimpSuppression.count(),
  ]);
  console.log(JSON.stringify({ ...result, statuses, tags, suppressions }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
