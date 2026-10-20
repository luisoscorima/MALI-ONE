import { useId, useState } from 'react';
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
  faculty: 'Plana docente',
  gallery: 'Galería de imágenes',
  schedule: 'Modalidades y horarios',
  curriculum: 'Plan de estudios',
  investment: 'Inversión referencial',
  faq: 'Preguntas frecuentes',
  cta: 'Llamada a la acción',
  lead_form: 'Formulario de contacto',
  footer: 'Pie de página',
};

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function defaultBlock(type: LandingBlockType): LandingBlock {
  const id = `${type}-${crypto.randomUUID()}`;
  const common = { id, type, enabled: true };
  switch (type) {
    case 'hero':
      return {
        ...common,
        data: {
          eyebrow: 'Extensión Profesional',
          title: 'Título del programa',
          body: 'Presenta la propuesta principal del programa.',
          backgroundColor: '#0022cc',
          videoUrl: '',
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
    case 'faculty':
      return {
        ...common,
        data: {
          eyebrow: 'Plana docente',
          title: 'Conoce a nuestros docentes',
          intro: '',
          note: 'La participación de docentes puede variar según la edición.',
          items: [],
        },
      };
    case 'gallery':
      return {
        ...common,
        data: {
          eyebrow: 'Experiencia MALI',
          title: 'Vive la experiencia MALI',
          intro: '',
          items: [],
        },
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
    case 'curriculum':
      return { ...common, data: { eyebrow: 'Plan de estudios', title: 'Plan de estudios', intro: '', items: [], finalTitle: 'Proyecto Integrador Final', finalDescription: '' } };
    case 'investment':
      return { ...common, data: { eyebrow: 'Inversión referencial', title: 'Planifica tu siguiente paso', currency: 'S/', enrollment: '', installments: '', installmentAmount: '', note: '', label: 'Consultar beneficios' } };
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
  const id = useId();
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

type ItemField = { key: string; label: string; multiline?: boolean };

function ItemsEditor({ value, fields, onChange, label }: {
  value: unknown; fields: ItemField[]; onChange: (items: Record<string, unknown>[]) => void; label: string;
}) {
  const items = Array.isArray(value) ? value.map((item) => item && typeof item === 'object' ? item as Record<string, unknown> : {}) : [];
  return <div className="space-y-3 md:col-span-2">
    <p className="text-sm font-medium">{label} ({items.length}/50)</p>
    {items.map((item, index) => <div key={index} className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between"><span className="text-sm font-medium">{index + 1}. {stringValue(item.title || item.name || item.label) || label}</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(items.filter((_, i) => i !== index))}>Eliminar</Button></div>
      <div className="grid gap-3 md:grid-cols-2">{fields.map((field) => <div key={field.key} className={field.multiline ? 'md:col-span-2' : ''}>
        <DataField label={field.label} value={item[field.key]} multiline={field.multiline} onChange={(next) => onChange(items.map((entry, i) => i === index ? { ...entry, [field.key]: next } : entry))} />
      </div>)}</div>
    </div>)}
    <Button type="button" variant="outline" disabled={items.length >= 50} onClick={() => onChange([...items, {}])}><Plus className="mr-1 size-4" />Añadir elemento</Button>
  </div>;
}

function BlockFields({ block, update }: { block: LandingBlock; update: (key: string, value: unknown) => void }) {
  const field = (label: string, key: string, multiline = false) => <DataField label={label} value={block.data[key]} onChange={(value) => update(key, value)} multiline={multiline} />;
  const itemFields = (label: string, fields: ItemField[], key = 'items') => <ItemsEditor value={block.data[key]} fields={fields} label={label} onChange={(items) => update(key, items)} />;
  const heading = <>{field('Antetítulo', 'eyebrow')}{field('Título', 'title')}</>;
  switch (block.type) {
    case 'hero': return <div className="grid gap-3 md:grid-cols-2">{heading}{field('Descripción', 'body', true)}{field('Texto del botón', 'ctaLabel')}{field('Color de fondo sólido', 'backgroundColor')}{field('URL del video MP4 (opcional)', 'videoUrl')}{field('Imagen alternativa del video', 'imageUrl')}{field('Texto alternativo', 'imageAlt')}
      <p className="text-xs text-muted-foreground md:col-span-2">Sin URL de video se mostrará el fondo sólido. El video se fundirá con el fondo, sin audio y en bucle.</p>
      {itemFields('Datos destacados', [{ key: 'label', label: 'Etiqueta' }, { key: 'value', label: 'Valor' }], 'facts')}</div>;
    case 'text': return <div className="grid gap-3">{heading}{field('Contenido', 'body', true)}</div>;
    case 'feature_list': return <div className="grid gap-3 md:grid-cols-2">{heading}{field('Introducción', 'intro', true)}{itemFields('Elementos', [{ key: 'title', label: 'Título' }, { key: 'description', label: 'Descripción', multiline: true }])}</div>;
    case 'faculty': return <div className="grid gap-3 md:grid-cols-2">{heading}{field('Introducción', 'intro', true)}{field('Nota', 'note', true)}{itemFields('Docentes', [
      { key: 'name', label: 'Nombre' }, { key: 'role', label: 'Especialidad o cargo' }, { key: 'description', label: 'Descripción del docente', multiline: true }, { key: 'imageUrl', label: 'URL de la fotografía' }, { key: 'imageAlt', label: 'Texto alternativo' }, { key: 'linkedinUrl', label: 'URL de LinkedIn (opcional)' },
    ])}<p className="text-xs text-muted-foreground md:col-span-2">El botón de LinkedIn aparecerá cuando añadas una URL válida.</p></div>;
    case 'gallery': return <div className="grid gap-3 md:grid-cols-2">{heading}{field('Introducción', 'intro', true)}{itemFields('Imágenes', [{ key: 'imageUrl', label: 'URL de imagen' }, { key: 'imageAlt', label: 'Texto alternativo' }, { key: 'caption', label: 'Leyenda' }])}</div>;
    case 'schedule': return <div className="grid gap-3 md:grid-cols-2">{heading}{itemFields('Modalidades', [{ key: 'title', label: 'Modalidad' }, { key: 'date', label: 'Fecha' }, { key: 'location', label: 'Lugar o plataforma' }, { key: 'schedule', label: 'Horario' }])}</div>;
    case 'curriculum': return <div className="grid gap-3 md:grid-cols-2">{heading}{field('Introducción', 'intro', true)}{itemFields('Módulos', [{ key: 'title', label: 'Nombre del módulo' }, { key: 'description', label: 'Descripción del módulo', multiline: true }])}{field('Título del proyecto final', 'finalTitle')}{field('Descripción del proyecto final', 'finalDescription', true)}</div>;
    case 'investment': return <div className="grid gap-3 md:grid-cols-2">{heading}{field('Moneda', 'currency')}{field('Matrícula', 'enrollment')}{field('Cantidad de cuotas', 'installments')}{field('Importe por cuota', 'installmentAmount')}{field('Condiciones y nota referencial', 'note', true)}{field('Texto del botón', 'label')}</div>;
    case 'faq': return <div className="grid gap-3 md:grid-cols-2">{heading}{itemFields('Preguntas', [{ key: 'question', label: 'Pregunta' }, { key: 'answer', label: 'Respuesta', multiline: true }])}</div>;
    case 'cta': return <div className="grid gap-3 md:grid-cols-2">{heading}{field('Texto del botón', 'label')}{field('URL', 'url')}{field('Descripción', 'body', true)}</div>;
    case 'lead_form': return <div className="grid gap-3 md:grid-cols-2">{heading}{field('Descripción', 'body', true)}{field('Texto del botón', 'submitLabel')}
      <div className="space-y-1"><Label htmlFor={block.id + '-area'}>Área CRM</Label><select id={block.id + '-area'} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={stringValue(block.data.area) || 'educacion_ep'} onChange={(event) => update('area', event.target.value)}><option value="educacion_ep">Educación EP</option><option value="educacion_ca">Educación CA</option></select></div>
      {field('Slug del curso', 'courseSlug')}{field('Nombre del curso', 'courseTitle')}{field('Número de WhatsApp', 'whatsappPhone')}{field('Color de fondo', 'backgroundColor')}{field('URL de privacidad', 'privacyUrl')}</div>;
    case 'footer': return field('Texto', 'text');
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
            <Trash2 className="size-4" /><span className="sr-only">Eliminar bloque</span>
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
    if (value.blocks.length >= 50 || (selectedType === 'lead_form' && hasLeadForm)) return;
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

        <div className="space-y-1"><Label htmlFor="landing-logo-width">Ancho del logo (180–340 px)</Label><Input id="landing-logo-width" type="number" min={180} max={340} value={value.logoWidth ?? 270} onChange={(event) => onChange({ ...value, logoWidth: Number(event.target.value) })} /></div>
        <div className="space-y-1"><Label htmlFor="landing-form-layout">Presentación del formulario</Label><select id="landing-form-layout" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={value.leadFormLayout ?? 'inline'} onChange={(event) => onChange({ ...value, leadFormLayout: event.target.value as 'inline' | 'sticky' })}><option value="inline">Sección dentro de la página</option><option value="sticky">Lateral después del hero / desplegable en móvil</option></select></div>
        <div className="space-y-3 md:col-span-2"><p className="text-sm font-medium">Navegación por secciones</p><p className="text-xs text-muted-foreground">Selecciona las secciones que aparecerán en la navbar y edita sus etiquetas. Las secciones ocultas no aparecerán en la página pública.</p>
          {value.blocks.filter((block) => !['hero', 'footer', 'lead_form'].includes(block.type)).map((block) => {
            const item = value.navigation?.find((entry) => entry.blockId === block.id);
            return <div key={block.id} className="flex items-center gap-3"><Switch aria-label={'Mostrar ' + block.id + ' en navegación'} checked={!!item} onCheckedChange={(checked) => onChange({ ...value, navigation: checked ? [...(value.navigation ?? []), { blockId: block.id, label: stringValue(block.data.title).slice(0, 60) || BLOCK_LABELS[block.type] }] : value.navigation?.filter((entry) => entry.blockId !== block.id) })} /><span className="w-32 truncate text-xs text-muted-foreground">{block.id}</span><Input aria-label={'Etiqueta de navegación para ' + block.id} disabled={!item} maxLength={60} value={item?.label ?? ''} onChange={(event) => onChange({ ...value, navigation: value.navigation?.map((entry) => entry.blockId === block.id ? { ...entry, label: event.target.value } : entry) })} /></div>;
          })}
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
        <Button type="button" variant="outline" disabled={value.blocks.length >= 50} onClick={addBlock}>
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
