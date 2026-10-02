import { useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import type {
  LandingBlock,
  LandingBlockType,
  LandingDocument,
} from '@mali-one/shared';
import {
  Button,
  Input,
  Label,
  Switch,
  Textarea,
} from '@/components/ui';

const BLOCK_LABELS: Record<LandingBlockType, string> = {
  hero: 'Hero',
  text: 'Texto',
  feature_list: 'Lista de beneficios',
  schedule: 'Modalidades y horarios',
  faq: 'Preguntas frecuentes',
  cta: 'Llamada a la acción',
  lead_form: 'Formulario de contacto',
  footer: 'Pie de página',
};

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function rows(value: unknown, keys: string[]): string {
  if (!Array.isArray(value)) return '';
  return value
    .map((item) => {
      const row = item && typeof item === 'object' ? item : {};
      return keys
        .map((key) => stringValue((row as Record<string, unknown>)[key]))
        .join(' | ');
    })
    .join('\n');
}

function parseRows(value: string, keys: string[]) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|').map((part) => part.trim());
      return Object.fromEntries(keys.map((key, index) => [key, parts[index] ?? '']));
    });
}

function defaultBlock(type: LandingBlockType): LandingBlock {
  const id = `${type}-${Date.now().toString(36)}`;
  const common = { id, type, enabled: true };
  switch (type) {
    case 'hero':
      return {
        ...common,
        data: {
          eyebrow: 'Extensión Profesional',
          title: 'Título del programa',
          body: 'Presenta la propuesta principal del programa.',
          imageUrl: '',
          imageAlt: '',
          ctaLabel: 'Solicitar información',
          facts: [],
        },
      };
    case 'text':
      return {
        ...common,
        data: { eyebrow: '', title: 'Nueva sección', body: '' },
      };
    case 'feature_list':
      return {
        ...common,
        data: { eyebrow: '', title: 'Beneficios', intro: '', items: [] },
      };
    case 'schedule':
      return {
        ...common,
        data: { eyebrow: '', title: 'Modalidades', items: [] },
      };
    case 'faq':
      return {
        ...common,
        data: { eyebrow: '', title: 'Preguntas frecuentes', items: [] },
      };
    case 'cta':
      return {
        ...common,
        data: { eyebrow: '', title: 'Conoce más', body: '', label: 'Ver más', url: '' },
      };
    case 'lead_form':
      return {
        ...common,
        data: {
          eyebrow: 'Conversemos',
          title: 'Quiero recibir información',
          body: 'Estamos listos para brindarte la asesoría que necesitas.',
          submitLabel: 'Enviar información',
          area: 'educacion_ep',
          courseSlug: '',
          courseTitle: '',
          whatsappPhone: '',
          backgroundColor: '#b4b3ff',
          privacyUrl: '',
        },
      };
    case 'footer':
      return { ...common, data: { text: 'MALI Educación · Museo de Arte de Lima' } };
  }
}

type DataFieldProps = {
  label: string;
  value: unknown;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
};

function DataField({
  label,
  value,
  onChange,
  multiline,
  placeholder,
}: DataFieldProps) {
  const id = `landing-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <Textarea
          id={id}
          value={stringValue(value)}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={4}
        />
      ) : (
        <Input
          id={id}
          value={stringValue(value)}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function BlockFields({
  block,
  update,
}: {
  block: LandingBlock;
  update: (key: string, value: unknown) => void;
}) {
  const field = (label: string, key: string, multiline = false) => (
    <DataField
      label={label}
      value={block.data[key]}
      onChange={(value) => update(key, value)}
      multiline={multiline}
    />
  );

  switch (block.type) {
    case 'hero':
      return (
        <div className="grid gap-3 md:grid-cols-2">
          {field('Antetítulo', 'eyebrow')}
          {field('CTA', 'ctaLabel')}
          <div className="md:col-span-2">{field('Título', 'title')}</div>
          <div className="md:col-span-2">{field('Descripción', 'body', true)}</div>
          {field('URL de imagen', 'imageUrl')}
          {field('Texto alternativo', 'imageAlt')}
          <div className="space-y-1 md:col-span-2">
            <Label>Datos destacados</Label>
            <Textarea
              value={rows(block.data.facts, ['label', 'value'])}
              onChange={(event) =>
                update('facts', parseRows(event.target.value, ['label', 'value']))
              }
              placeholder={'Etiqueta | Valor\nDuración | 9 meses'}
              rows={4}
            />
          </div>
        </div>
      );
    case 'text':
      return (
        <div className="grid gap-3">
          {field('Antetítulo', 'eyebrow')}
          {field('Título', 'title')}
          {field('Contenido', 'body', true)}
        </div>
      );
    case 'feature_list':
      return (
        <div className="grid gap-3">
          {field('Antetítulo', 'eyebrow')}
          {field('Título', 'title')}
          {field('Introducción', 'intro', true)}
          <div className="space-y-1">
            <Label>Elementos</Label>
            <Textarea
              value={rows(block.data.items, ['title', 'description'])}
              onChange={(event) =>
                update(
                  'items',
                  parseRows(event.target.value, ['title', 'description']),
                )
              }
              placeholder={'Título | Descripción\nCasos reales | Aprende con situaciones del sector'}
              rows={7}
            />
          </div>
        </div>
      );
    case 'schedule':
      return (
        <div className="grid gap-3">
          {field('Antetítulo', 'eyebrow')}
          {field('Título', 'title')}
          <div className="space-y-1">
            <Label>Modalidades</Label>
            <Textarea
              value={rows(block.data.items, [
                'title',
                'date',
                'location',
                'schedule',
              ])}
              onChange={(event) =>
                update(
                  'items',
                  parseRows(event.target.value, [
                    'title',
                    'date',
                    'location',
                    'schedule',
                  ]),
                )
              }
              placeholder="Modalidad | Fecha | Lugar | Horario"
              rows={6}
            />
          </div>
        </div>
      );
    case 'faq':
      return (
        <div className="grid gap-3">
          {field('Antetítulo', 'eyebrow')}
          {field('Título', 'title')}
          <div className="space-y-1">
            <Label>Preguntas</Label>
            <Textarea
              value={rows(block.data.items, ['question', 'answer'])}
              onChange={(event) =>
                update(
                  'items',
                  parseRows(event.target.value, ['question', 'answer']),
                )
              }
              placeholder="Pregunta | Respuesta"
              rows={8}
            />
          </div>
        </div>
      );
    case 'cta':
      return (
        <div className="grid gap-3 md:grid-cols-2">
          {field('Antetítulo', 'eyebrow')}
          {field('Texto del botón', 'label')}
          <div className="md:col-span-2">{field('Título', 'title')}</div>
          <div className="md:col-span-2">{field('Descripción', 'body', true)}</div>
          <div className="md:col-span-2">{field('URL', 'url')}</div>
        </div>
      );
    case 'lead_form':
      return (
        <div className="grid gap-3 md:grid-cols-2">
          {field('Antetítulo', 'eyebrow')}
          {field('Texto del botón', 'submitLabel')}
          <div className="md:col-span-2">{field('Título', 'title')}</div>
          <div className="md:col-span-2">{field('Descripción', 'body', true)}</div>
          <div className="space-y-1">
            <Label>Área CRM</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={stringValue(block.data.area) || 'educacion_ep'}
              onChange={(event) => update('area', event.target.value)}
            >
              <option value="educacion_ep">Educación EP</option>
              <option value="educacion_ca">Educación CA</option>
            </select>
          </div>
          {field('Slug del curso', 'courseSlug')}
          {field('Nombre del curso', 'courseTitle')}
          {field('Número de WhatsApp', 'whatsappPhone')}
          {field('Color de fondo', 'backgroundColor')}
          {field('URL de privacidad', 'privacyUrl')}
        </div>
      );
    case 'footer':
      return field('Texto', 'text');
  }
}

function SortableBlock({
  block,
  onChange,
  onRemove,
}: {
  block: LandingBlock;
  onChange: (block: LandingBlock) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: block.id });

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="space-y-4 rounded-xl border border-border/70 bg-card p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-grab rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Reordenar bloque"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-5" />
          </button>
          <div>
            <p className="font-semibold">{BLOCK_LABELS[block.type]}</p>
            <p className="font-mono text-xs text-muted-foreground">{block.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Switch
              checked={block.enabled}
              onCheckedChange={(enabled) => onChange({ ...block, enabled })}
            />
            Visible
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={onRemove}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      <BlockFields
        block={block}
        update={(key, value) =>
          onChange({ ...block, data: { ...block.data, [key]: value } })
        }
      />
    </article>
  );
}

export function LandingEditor({
  value,
  onChange,
}: {
  value: LandingDocument;
  onChange: (value: LandingDocument) => void;
}) {
  const [newType, setNewType] = useState<LandingBlockType>('text');
  const hasLeadForm = value.blocks.some((block) => block.type === 'lead_form');
  const availableBlockTypes = (
    Object.entries(BLOCK_LABELS) as [LandingBlockType, string][]
  ).filter(([type]) => type !== 'lead_form' || !hasLeadForm);
  const selectedType =
    newType === 'lead_form' && hasLeadForm ? 'text' : newType;
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = value.blocks.findIndex((block) => block.id === active.id);
    const newIndex = value.blocks.findIndex((block) => block.id === over.id);
    onChange({ ...value, blocks: arrayMove(value.blocks, oldIndex, newIndex) });
  }

  function addBlock() {
    if (selectedType === 'lead_form' && hasLeadForm) return;
    onChange({
      ...value,
      blocks: [...value.blocks, defaultBlock(selectedType)],
    });
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 rounded-xl border border-border/70 p-4 md:grid-cols-2">
        <DataField
          label="URL del logotipo"
          value={value.logoUrl}
          onChange={(logoUrl) => onChange({ ...value, logoUrl })}
        />
        <DataField
          label="Texto alternativo del logotipo"
          value={value.logoAlt}
          onChange={(logoAlt) => onChange({ ...value, logoAlt })}
        />
        <DataField
          label="CTA de cabecera"
          value={value.headerCtaLabel}
          onChange={(headerCtaLabel) => onChange({ ...value, headerCtaLabel })}
        />
        <div className="grid grid-cols-5 gap-2">
          {(
            [
              ['primary', 'Principal'],
              ['secondary', 'Secundario'],
              ['accent', 'Acento'],
              ['ink', 'Texto'],
              ['surface', 'Fondo'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="grid gap-1 text-xs">
              {label}
              <input
                type="color"
                className="h-9 w-full rounded border"
                value={value.theme[key]}
                onChange={(event) =>
                  onChange({
                    ...value,
                    theme: { ...value.theme, [key]: event.target.value },
                  })
                }
              />
            </label>
          ))}
        </div>
      </section>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={value.blocks.map((block) => block.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {value.blocks.map((block, index) => (
              <SortableBlock
                key={block.id}
                block={block}
                onChange={(next) => {
                  const blocks = [...value.blocks];
                  blocks[index] = next;
                  onChange({ ...value, blocks });
                }}
                onRemove={() =>
                  onChange({
                    ...value,
                    blocks: value.blocks.filter((item) => item.id !== block.id),
                  })
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-4">
        <select
          className="h-9 min-w-56 rounded-md border border-input bg-transparent px-3 text-sm"
          value={selectedType}
          onChange={(event) => setNewType(event.target.value as LandingBlockType)}
        >
          {availableBlockTypes.map(([type, label]) => (
            <option key={type} value={type}>
              {label}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" onClick={addBlock}>
          <Plus className="mr-1 size-4" /> Añadir bloque
        </Button>
        {hasLeadForm ? (
          <p className="basis-full text-xs text-muted-foreground">
            Solo se permite un formulario de contacto por landing.
          </p>
        ) : null}
      </div>
    </div>
  );
}
