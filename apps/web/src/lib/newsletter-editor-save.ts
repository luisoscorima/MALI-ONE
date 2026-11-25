import type { RefObject } from 'react';
import type { NewsletterEditorHandle } from '@/components/newsletter-editor';
import {
  externalizeNewsletterImages,
  type NewsletterEditorExport,
} from '@/lib/newsletter-content';

export function assertEditorReadyToSave(
  editorRef: RefObject<NewsletterEditorHandle | null>,
): void {
  if (editorRef.current?.hasPendingUploads()) {
    throw new Error('Espera a que termine la subida de imágenes y vuelve a guardar.');
  }
}

/** Snapshot current canvas before remounting (e.g. brand change). */
export function preserveEditorExport(
  editorRef: RefObject<NewsletterEditorHandle | null>,
): NewsletterEditorExport | null {
  if (editorRef.current?.hasPendingUploads()) {
    throw new Error('Espera a que termine la subida de imágenes para cambiar la marca.');
  }
  const exported = editorRef.current?.getExport();
  if (!exported?.htmlBody?.trim()) return null;
  return exported;
}

export async function exportNewsletterForSave(
  editorRef: RefObject<NewsletterEditorHandle | null>,
  upload: (file: File) => Promise<string>,
  uploadedImages: Map<string, string>,
): Promise<NewsletterEditorExport> {
  assertEditorReadyToSave(editorRef);
  const exported = editorRef.current?.getExport();
  if (!exported?.htmlBody?.trim()) {
    throw new Error('El contenido no tiene HTML.');
  }
  return externalizeNewsletterImages(exported, upload, uploadedImages);
}

export function appendMergeTagToSubject(current: string, tag: string): string {
  return `${current}${current && !/\s$/.test(current) ? ' ' : ''}${tag}`;
}
