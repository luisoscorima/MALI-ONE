import { spawn } from 'child_process';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import ffmpegStatic from 'ffmpeg-static';

function resolveFfmpegBin(): string {
  const fromEnv = process.env.FFMPEG_PATH?.trim();
  if (fromEnv) return fromEnv;
  if (ffmpegStatic) return ffmpegStatic;
  return 'ffmpeg';
}

/**
 * Transcode iPhone MOV/QuickTime (often HEVC) to H.264 MP4 for Samsung/Tizen.
 */
export async function convertMovBufferToMp4(input: Buffer): Promise<Buffer> {
  const bin = resolveFfmpegBin();
  const dir = await mkdtemp(join(tmpdir(), 'screen-cast-vid-'));
  const inPath = join(dir, 'input.mov');
  const outPath = join(dir, 'output.mp4');

  try {
    await writeFile(inPath, input);

    await new Promise<void>((resolve, reject) => {
      const args = [
        '-hide_banner',
        '-y',
        '-i',
        inPath,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-ac',
        '2',
        '-movflags',
        '+faststart',
        // Cap long edge at 1920; keep aspect ratio.
        '-vf',
        "scale='min(1920,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease",
        outPath,
      ];

      const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
        if (stderr.length > 8000) stderr = stderr.slice(-4000);
      });
      proc.on('error', (err) => {
        reject(
          new Error(
            `No se pudo ejecutar ffmpeg (${bin}): ${err.message}. Instala ffmpeg o define FFMPEG_PATH.`,
          ),
        );
      });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else {
          reject(
            new Error(
              stderr.trim().slice(-600) ||
                `ffmpeg terminó con código ${code ?? 'desconocido'}`,
            ),
          );
        }
      });
    });

    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function isMovUpload(mime: string, fileName: string): boolean {
  const m = mime.toLowerCase();
  if (m === 'video/quicktime' || m === 'video/x-quicktime') return true;
  return /\.mov$/i.test(fileName);
}
