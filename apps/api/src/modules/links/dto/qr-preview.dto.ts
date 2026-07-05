import { DEFAULT_QR_STYLE } from '@mali-one/shared';
import { BadRequestException } from '@nestjs/common';
import { UpdateQrStyleDto } from './update-qr-style.dto';

export interface QrPreviewPayload {
  data: string;
  style: UpdateQrStyleDto;
  linkId?: string;
}

export function parseQrPreviewPayload(raw: string): QrPreviewPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException('Payload de vista previa inválido');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new BadRequestException('Payload de vista previa inválido');
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.data !== 'string' || !obj.data.trim()) {
    throw new BadRequestException('URL de vista previa requerida');
  }
  return {
    data: obj.data.trim(),
    style: (obj.style as UpdateQrStyleDto | undefined) ?? { ...DEFAULT_QR_STYLE },
    linkId: typeof obj.linkId === 'string' ? obj.linkId : undefined,
  };
}
