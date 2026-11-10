import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeLandingSeo } from '../apps/web/src/lib/landing-seo';

const content = {
  blocks: [
    { id: 'hero', type: 'hero', enabled: true, data: {
      title: 'Programa de Gestión Cultural',
      body: 'Aprende a liderar proyectos culturales.',
      imageUrl: 'https://example.com/gestion-cultural.jpg',
    } },
    { id: 'hidden', type: 'text', enabled: false, data: {
      body: 'Diplomado en Gestión Cultural',
    } },
  ],
} as unknown as Parameters<typeof analyzeLandingSeo>[3];

test('revisa frase completa sin depender de tildes ni puntuación', () => {
  assert.deepEqual(
    analyzeLandingSeo(
      'gestión cultural',
      'Gestión Cultural | MALI',
      'Aprende sobre gestion-cultural en el museo.',
      content,
    ),
    { title: true, description: true, content: true },
  );
});

test('ignora bloques ocultos, enlaces y coincidencias dentro de otras palabras', () => {
  assert.deepEqual(
    analyzeLandingSeo('diplomado en gestión cultural', 'Diplomados', '', content),
    { title: false, description: false, content: false },
  );
  assert.deepEqual(
    analyzeLandingSeo('example com gestion cultural', '', '', content),
    { title: false, description: false, content: false },
  );
});

test('no muestra análisis sin frase clave', () => {
  assert.equal(analyzeLandingSeo('  ', 'Gestión Cultural', '', content), null);
});
