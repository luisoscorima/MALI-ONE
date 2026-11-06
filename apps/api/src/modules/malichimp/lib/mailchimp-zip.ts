import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { IMPORT_FILES } from './malichimp-import';

const EOCD = 0x06054b50;
const CENTRAL_HEADER = 0x02014b50;
const LOCAL_HEADER = 0x04034b50;
const MAX_ENTRIES = 200;
const MAX_FILE_BYTES = 150 * 1024 * 1024;
const MAX_TOTAL_BYTES = 300 * 1024 * 1024;

type ZipEntry = {
  name: string;
  method: number;
  flags: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
};

function findEocd(buffer: Buffer): number {
  const minimum = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD) return offset;
  }
  throw new Error('El archivo no es un ZIP válido');
}

function readEntries(buffer: Buffer): ZipEntry[] {
  const eocd = findEocd(buffer);
  const disk = buffer.readUInt16LE(eocd + 4);
  const centralDisk = buffer.readUInt16LE(eocd + 6);
  const entries = buffer.readUInt16LE(eocd + 10);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (disk !== 0 || centralDisk !== 0) throw new Error('ZIP multipart no soportado');
  if (entries > MAX_ENTRIES) throw new Error(`El ZIP excede ${MAX_ENTRIES} archivos`);

  const result: ZipEntry[] = [];
  let offset = centralOffset;
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== CENTRAL_HEADER) {
      throw new Error('Directorio interno del ZIP inválido');
    }
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    if ([compressedSize, uncompressedSize, localOffset].includes(0xffffffff)) {
      throw new Error('ZIP64 no soportado');
    }
    const nameEnd = offset + 46 + nameLength;
    if (nameEnd > buffer.length) throw new Error('Nombre interno del ZIP inválido');
    result.push({
      name: buffer.subarray(offset + 46, nameEnd).toString('utf8'),
      method,
      flags,
      compressedSize,
      uncompressedSize,
      localOffset,
    });
    offset = nameEnd + extraLength + commentLength;
  }
  return result;
}

function unpackEntry(buffer: Buffer, entry: ZipEntry): Buffer {
  if (entry.flags & 1) throw new Error('ZIP cifrado no soportado');
  if (entry.uncompressedSize > MAX_FILE_BYTES) {
    throw new Error(`El archivo ${path.basename(entry.name)} excede 150 MB`);
  }
  const offset = entry.localOffset;
  if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== LOCAL_HEADER) {
    throw new Error('Entrada interna del ZIP inválida');
  }
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (end > buffer.length) throw new Error('Contenido truncado dentro del ZIP');
  const compressed = buffer.subarray(start, end);
  const output = entry.method === 0
    ? Buffer.from(compressed)
    : entry.method === 8
      ? inflateRawSync(compressed, { maxOutputLength: MAX_FILE_BYTES })
      : null;
  if (!output) throw new Error(`Compresión ZIP no soportada: ${entry.method}`);
  if (output.length !== entry.uncompressedSize) {
    throw new Error(`Tamaño inválido para ${path.basename(entry.name)}`);
  }
  return output;
}

export async function extractMailchimpZip(buffer: Buffer, directory: string) {
  const entries = readEntries(buffer);
  const selected = IMPORT_FILES.map(({ prefix }) => {
    const matches = entries.filter((entry) => {
      const basename = path.posix.basename(entry.name.replaceAll('\\', '/'));
      return basename.startsWith(prefix) && basename.endsWith('.csv');
    });
    if (matches.length !== 1) {
      throw new Error(
        `El ZIP debe incluir exactamente un ${prefix}*.csv; encontrados: ${matches.length}`,
      );
    }
    return matches[0];
  });
  const total = selected.reduce((sum, entry) => sum + entry.uncompressedSize, 0);
  if (total > MAX_TOTAL_BYTES) throw new Error('El contenido del ZIP excede 300 MB');

  await mkdir(directory, { recursive: true, mode: 0o700 });
  for (const entry of selected) {
    const basename = path.posix.basename(entry.name.replaceAll('\\', '/'));
    await writeFile(path.join(directory, basename), unpackEntry(buffer, entry), {
      mode: 0o600,
    });
  }
  return selected.map((entry) => path.posix.basename(entry.name));
}
