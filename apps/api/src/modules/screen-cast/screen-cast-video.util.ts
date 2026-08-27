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

function resolveFfprobeBin(): string {
  const fromEnv = process.env.FFPROBE_PATH?.trim();
  if (fromEnv) return fromEnv;
  const ffmpeg = resolveFfmpegBin();
  if (/ffmpeg(\.exe)?$/i.test(ffmpeg)) {
    return ffmpeg.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');
  }
  return 'ffprobe';
}

function parseFfmpegDuration(stderr: string): number | null {
  const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number.parseFloat(match[3]);
  if (!Number.isFinite(hours + minutes + seconds)) return null;
  const total = hours * 3600 + minutes * 60 + seconds;
  if (total <= 0) return null;
  return Math.round(total * 1000);
}

async function probeWithFfprobe(input: string): Promise<number | null> {
  const ffprobe = resolveFfprobeBin();
  return new Promise<number | null>((resolve) => {
    const args = [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      input,
    ];
    const proc = spawn(ffprobe, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    proc.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.on('error', () => resolve(null));
    proc.on('close', (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      const sec = Number.parseFloat(stdout.trim());
      if (Number.isFinite(sec) && sec > 0) {
        resolve(Math.round(sec * 1000));
        return;
      }
      resolve(null);
    });
  });
}

async function probeWithFfmpeg(input: string): Promise<number | null> {
  const ffmpeg = resolveFfmpegBin();
  return new Promise<number | null>((resolve) => {
    const args = ['-hide_banner', '-i', input, '-f', 'null', '-'];
    const proc = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let settled = false;
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      proc.kill('SIGKILL');
      resolve(value);
    };
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 12000) stderr = stderr.slice(-8000);
      const parsed = parseFfmpegDuration(stderr);
      if (parsed) finish(parsed);
    });
    proc.on('error', () => finish(null));
    proc.on('close', () => finish(parseFfmpegDuration(stderr)));
  });
}

/** Read MP4/MOV duration via ffprobe/ffmpeg (buffer or public URL). */
export async function probeVideoDurationMs(
  source: string | Buffer,
): Promise<number | null> {
  let input = typeof source === 'string' ? source : '';
  let tempDir: string | null = null;

  try {
    if (Buffer.isBuffer(source)) {
      tempDir = await mkdtemp(join(tmpdir(), 'screen-cast-probe-'));
      input = join(tempDir, 'input.mp4');
      await writeFile(input, source);
    }

    const fromFfprobe = await probeWithFfprobe(input);
    if (fromFfprobe) return fromFfprobe;
    return probeWithFfmpeg(input);
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
