import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Copy,
  Eye,
  Download,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  FlaskConical,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import type {
  EmailSenderDto,
  MalichimpAudienceMode,
  MalichimpAudiencePreviewDto,
  MalichimpBlockedEmailReason,
  MalichimpCampaignDetailDto,
  MalichimpCampaignDto,
  MalichimpGroupDto,
  MalichimpResolveEmailsDto,
  MalichimpStatsDto,
  MalichimpTagDto,
  MalichimpTestRecipientDto,
  NewsletterDto,
} from '@mali-one/shared';
import { AlertBanner, Spinner, TableShellSkeleton } from '@/components/feedback';
import { IconActionButton } from '@/components/icon-action-button';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import { api } from '@/lib/api';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
  Textarea,
} from '@/components/ui';
import { cn } from '@/lib/utils';

const MalichimpCampaignStatsPanel = lazy(() =>
  import('@/components/malichimp-campaign-stats-panel').then((m) => ({
    default: m.MalichimpCampaignStatsPanel,
  })),
);

const nf = new Intl.NumberFormat('es-PE');
const pf = new Intl.NumberFormat('es-PE', {
  style: 'percent',
  maximumFractionDigits: 1,
});
const df = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const maliPeEmailPattern = /^[^@\s]+@mali\.pe$/i;
const RECIPIENT_PAGE_SIZE = 50;
const PASTE_STORAGE_KEY = 'malichimp-campaign-paste-list';
const MAX_PASTE_EMAILS = 10_000;
const RESOLVE_DETAIL_PAGE = 50;

const CAMPAIGN_STEPS = [
  { id: 'to', label: 'Para', hint: 'Destinatarios' },
  { id: 'from', label: 'De', hint: 'Remitente' },
  { id: 'content', label: 'Contenido', hint: 'Boletín y asunto' },
  { id: 'send', label: 'Envío', hint: 'Programar o enviar' },
] as const;

type CampaignStepId = (typeof CAMPAIGN_STEPS)[number]['id'];

const statusLabel: Record<MalichimpCampaignDto['status'], string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  queued: 'En cola',
  sending: 'Enviando',
  completed: 'Completada',
  failed: 'Fallida',
};

type Props = {
  groups: MalichimpGroupDto[];
  tags: MalichimpTagDto[];
  delivery: MalichimpStatsDto['delivery'] | null;
  senders: EmailSenderDto[];
  openNew?: boolean;
  openCampaignId?: string | null;
  onDeepLinkConsumed?: (keys: Array<'new' | 'campaign'>) => void;
};

function parsePastedEmails(text: string): string[] {
  const parts = text.split(/[,;\s]+/).map((part) => part.trim()).filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(part);
    }
  }
  return unique;
}

function blockedReasonLabel(reason: MalichimpBlockedEmailReason): string {
  switch (reason) {
    case 'unsubscribed':
      return 'Dado de baja';
    case 'cleaned':
      return 'Correo marcado como inválido';
    case 'suppressed':
      return 'En lista de exclusión';
    case 'nonsubscribed':
      return 'Sin suscripción activa';
    default:
      return 'No puede recibir campañas';
  }
}

function clearPasteSession() {
  try {
    sessionStorage.removeItem(PASTE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function openMalichimpAudienceImport() {
  const url = `${window.location.origin}/admin/malichimp?tab=audience`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

const AUDIENCE_MODE_OPTIONS: Array<{
  id: MalichimpAudienceMode;
  title: string;
  description: string;
}> = [
  { id: 'groups', title: 'Grupos', description: 'Según categorías de los contactos.' },
  { id: 'tags', title: 'Etiquetas', description: 'Según etiquetas de Mailchimp.' },
  { id: 'emails', title: 'Lista de correos', description: 'Pegando direcciones concretas.' },
];

function AudienceModeRadioCards({
  value,
  onChange,
}: {
  value: MalichimpAudienceMode;
  onChange: (mode: MalichimpAudienceMode) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-base font-medium">¿Cómo quieres seleccionar la audiencia?</legend>
      <div
        className="flex flex-col gap-2 sm:flex-row sm:gap-3"
        role="radiogroup"
        aria-label="Forma de seleccionar la audiencia"
      >
        {AUDIENCE_MODE_OPTIONS.map((option) => (
          <label
            key={option.id}
            className={cn(
              'flex min-h-11 flex-1 cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors',
              'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2',
              value === option.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40',
            )}
          >
            <input
              type="radio"
              name="malichimp-audience-mode"
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
              className="mt-1 size-4 shrink-0 accent-primary"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{option.title}</span>
              <span className="block text-xs text-muted-foreground">{option.description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ResolveBucketSection({
  bucket,
  label,
  expanded,
  onToggle,
  children,
}: {
  bucket: 'notFound' | 'invalid' | 'blocked';
  label: string;
  expanded: Set<'notFound' | 'invalid' | 'blocked'>;
  onToggle: (bucket: 'notFound' | 'invalid' | 'blocked') => void;
  children: ReactNode;
}) {
  const open = expanded.has(bucket);
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm font-medium"
        onClick={() => onToggle(bucket)}
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {open ? children : null}
    </div>
  );
}

function PaginatedStringList({
  items,
  pageSize = RESOLVE_DETAIL_PAGE,
  renderItem,
  emptyLabel = 'Sin elementos',
}: {
  items: string[];
  pageSize?: number;
  renderItem?: (value: string) => ReactNode;
  emptyLabel?: string;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = items.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [items.length]);

  if (!items.length) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-2">
      <ul className="divide-y rounded-md border text-sm">
        {slice.map((item) => (
          <li key={item} className="px-3 py-1.5 font-mono text-xs">
            {renderItem ? renderItem(item) : item}
          </li>
        ))}
      </ul>
      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {nf.format(items.length)} en total · página {safePage} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={safePage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={safePage >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            >
              Ver más
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type FlatOption = {
  id: string;
  label: string;
  groupName: string;
  contacts: number;
};

function limaDateTimeToIso(value: string): string {
  return new Date(`${value}:00-05:00`).toISOString();
}

function minimumLimaDateTime(): string {
  const lima = new Date(Date.now() - 5 * 60 * 60 * 1_000);
  return lima.toISOString().slice(0, 16);
}

function GroupOptionMultiSelect({
  id,
  label,
  hint,
  options,
  selectedIds,
  disabledIds = [],
  onChange,
  placeholder = 'Seleccionar opciones',
}: {
  id: string;
  label: string;
  hint?: string;
  options: FlatOption[];
  selectedIds: string[];
  disabledIds?: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.filter((option) => selectedIds.includes(option.id));
  const filtered = options.filter((option) => {
    const haystack = `${option.groupName} ${option.label}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });
  const grouped = useMemo(() => {
    const map = new Map<string, FlatOption[]>();
    for (const option of filtered) {
      const bucket = map.get(option.groupName) ?? [];
      bucket.push(option);
      map.set(option.groupName, bucket);
    }
    return [...map.entries()];
  }, [filtered]);
  const selectedGrouped = useMemo(() => {
    const map = new Map<string, FlatOption[]>();
    for (const option of selected) {
      const bucket = map.get(option.groupName) ?? [];
      bucket.push(option);
      map.set(option.groupName, bucket);
    }
    return [...map.entries()];
  }, [selected]);

  function toggle(optionId: string, checked: boolean) {
    if (disabledIds.includes(optionId)) return;
    onChange(
      checked
        ? [...new Set([...selectedIds, optionId])]
        : selectedIds.filter((id) => id !== optionId),
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className="h-auto min-h-10 w-full justify-between px-3 py-2 font-normal"
            aria-expanded={open}
          >
            <span className="truncate text-left">
              {selected.length
                ? `${selected.length} opción${selected.length === 1 ? '' : 'es'} seleccionada${selected.length === 1 ? '' : 's'}`
                : placeholder}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="flex w-[min(28rem,calc(100vw-2rem))] max-h-[min(24rem,var(--radix-popover-content-available-height))] flex-col overflow-hidden p-2"
        >
          <div className="relative mb-2 shrink-0">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar grupo u opción"
              className="pl-8"
              aria-label={`Buscar en ${label}`}
            />
          </div>
          <div
            className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain touch-pan-y"
            onWheel={(event) => event.stopPropagation()}
          >
            {grouped.length ? grouped.map(([groupName, groupOptions]) => (
              <div key={groupName} className="space-y-1">
                <p className="sticky top-0 z-10 bg-popover px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {groupName}
                </p>
                {groupOptions.map((option) => {
                  const blocked = disabledIds.includes(option.id);
                  const checked = selectedIds.includes(option.id);
                  const inputId = `${id}-${option.id}`;
                  return (
                    <label
                      key={option.id}
                      htmlFor={inputId}
                      className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/60 ${blocked ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                      <Checkbox
                        id={inputId}
                        checked={checked}
                        disabled={blocked}
                        onCheckedChange={(value) => toggle(option.id, value === true)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{option.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {nf.format(option.contacts)} elegible{option.contacts === 1 ? '' : 's'}
                          {blocked ? ' · ya incluida' : ''}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )) : (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">Sin coincidencias</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {selectedGrouped.length ? (
        <div className="space-y-2">
          {selectedGrouped.map(([groupName, groupOptions]) => (
            <div key={groupName} className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {groupName}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {groupOptions.map((option) => (
                  <Badge key={option.id} variant="secondary" className="gap-1 pr-1">
                    <span className="max-w-[14rem] truncate">{option.label}</span>
                    <button
                      type="button"
                      className="rounded-sm p-0.5 hover:bg-muted"
                      aria-label={`Quitar ${option.label}`}
                      onClick={() => toggle(option.id, false)}
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NewsletterSearchSelect({
  id,
  label,
  newsletters,
  value,
  onChange,
  placeholder = 'Seleccionar',
}: {
  id: string;
  label: string;
  newsletters: NewsletterDto[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = newsletters.find((newsletter) => newsletter.id === value) ?? null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return newsletters;
    return newsletters.filter((newsletter) => {
      const haystack = `${newsletter.title} ${newsletter.subject} ${newsletter.slug}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [newsletters, query]);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery('');
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className="h-auto min-h-10 w-full justify-between px-3 py-2 font-normal"
            aria-expanded={open}
            aria-label={label}
          >
            <span className="truncate text-left">
              {selected ? selected.title : placeholder}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="flex w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] max-h-80 flex-col gap-2 overflow-hidden p-2"
        >
          <div className="relative shrink-0">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por título o asunto"
              className="pl-8"
              aria-label={`Buscar ${label}`}
            />
          </div>
          <div
            className="min-h-0 max-h-64 flex-1 space-y-1 overflow-x-hidden overflow-y-auto overscroll-contain touch-pan-y"
            onWheel={(event) => event.stopPropagation()}
          >
            {filtered.length ? filtered.map((newsletter) => {
              const active = newsletter.id === value;
              return (
                <button
                  key={newsletter.id}
                  type="button"
                  className={`flex w-full min-w-0 flex-col items-stretch gap-0.5 overflow-hidden rounded-md px-2 py-2 text-left text-sm hover:bg-muted/60 ${
                    active ? 'bg-muted' : ''
                  }`}
                  onClick={() => {
                    onChange(newsletter.id);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <span className="block w-full truncate font-medium">{newsletter.title}</span>
                  <span className="block w-full truncate text-xs text-muted-foreground">
                    {newsletter.scope === 'malichimp' ? 'MALICHIMP' : 'Boletines'}
                    {newsletter.subject ? ` · ${newsletter.subject}` : ''}
                  </span>
                </button>
              );
            }) : (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Sin coincidencias
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function MalichimpCampaigns({
  groups,
  tags,
  delivery,
  senders,
  openNew = false,
  openCampaignId = null,
  onDeepLinkConsumed,
}: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const sessionEmail = user?.email?.trim().toLowerCase() ?? '';
  const senderEmails = senders.map((sender) => sender.email);
  const defaultSenderEmail = delivery?.defaultFromEmail
    && senderEmails.includes(delivery.defaultFromEmail)
    ? delivery.defaultFromEmail
    : senderEmails[0] ?? '';
  const [campaigns, setCampaigns] = useState<MalichimpCampaignDto[]>([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [testQuery, setTestQuery] = useState('');
  const [testRecipients, setTestRecipients] = useState<MalichimpTestRecipientDto[]>([]);
  const [testLoading, setTestLoading] = useState(false);
  const [testSelected, setTestSelected] = useState<string[]>([]);
  const [newsletters, setNewsletters] = useState<NewsletterDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draftCampaignId, setDraftCampaignId] = useState<string | null>(null);
  const [attachedNewsletter, setAttachedNewsletter] = useState<NewsletterDto | null>(null);
  const [draftNewsletterId, setDraftNewsletterId] = useState<string | null>(null);
  const [contentRevision, setContentRevision] = useState<string | null>(null);
  const [showAdvancedSender, setShowAdvancedSender] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openingDraftId, setOpeningDraftId] = useState<string | null>(null);
  const [campaignPreview, setCampaignPreview] = useState<MalichimpCampaignDetailDto | null>(null);
  const [statsCampaign, setStatsCampaign] = useState<MalichimpCampaignDto | null>(null);
  const [previewCampaignId, setPreviewCampaignId] = useState<string | null>(null);
  const [refreshingContent, setRefreshingContent] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [preview, setPreview] = useState<MalichimpAudiencePreviewDto | null>(null);
  /** `all` = everyone selected except `manualExcludeIds`; `none` = only `manualIncludeIds`. */
  const [recipientSelectionMode, setRecipientSelectionMode] = useState<'all' | 'none'>('all');
  const [manualExcludeIds, setManualExcludeIds] = useState<Set<string>>(new Set());
  const [manualIncludeIds, setManualIncludeIds] = useState<Set<string>>(new Set());
  const [recipientQuery, setRecipientQuery] = useState('');
  const [debouncedRecipientQuery, setDebouncedRecipientQuery] = useState('');
  const [name, setName] = useState('');
  const [newsletterId, setNewsletterId] = useState('');
  const [subject, setSubject] = useState('');
  const [fromName, setFromName] = useState('Museo de Arte de Lima');
  const [fromEmail, setFromEmail] = useState(defaultSenderEmail);
  const [replyTo, setReplyTo] = useState(defaultSenderEmail);
  const [audienceMode, setAudienceMode] = useState<MalichimpAudienceMode>('groups');
  const [groupOptionIds, setGroupOptionIds] = useState<string[]>([]);
  const [excludeGroupOptionIds, setExcludeGroupOptionIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [excludeTagIds, setExcludeTagIds] = useState<string[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [resolveResult, setResolveResult] = useState<MalichimpResolveEmailsDto | null>(null);
  const [resolveBusy, setResolveBusy] = useState(false);
  const [resolveTouched, setResolveTouched] = useState(false);
  const [showGroupExclude, setShowGroupExclude] = useState(false);
  const [showTagExclude, setShowTagExclude] = useState(false);
  const [expandedResolveBuckets, setExpandedResolveBuckets] = useState<
    Set<'notFound' | 'invalid' | 'blocked'>
  >(new Set());
  const [scheduleMode, setScheduleMode] = useState<'now' | 'scheduled'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [formStep, setFormStep] = useState<CampaignStepId>('to');

  const flatOptions = useMemo<FlatOption[]>(
    () => groups.flatMap((group) => group.options.map((option) => ({
      id: option.id,
      label: option.name,
      groupName: group.name,
      contacts: option.contacts,
    }))),
    [groups],
  );
  const tagFlatOptions = useMemo<FlatOption[]>(
    () => tags.map((tag) => ({
      id: tag.id,
      label: tag.name,
      groupName: 'Etiquetas',
      contacts: tag.eligibleContacts ?? 0,
    })),
    [tags],
  );

  const selectableNewsletters = attachedNewsletter
    && !newsletters.some((newsletter) => newsletter.id === attachedNewsletter.id)
    ? [attachedNewsletter, ...newsletters]
    : newsletters;
  const selectedNewsletter = selectableNewsletters.find((newsletter) => newsletter.id === newsletterId) ?? null;
  const usingDraftContent = Boolean(
    selectedNewsletter
      && (
        draftCampaignId
        || (draftNewsletterId && selectedNewsletter.id === draftNewsletterId)
      ),
  );
  const availableGroups = groups.filter((group) => group.options.length > 0);
  const hasGroupOptions = availableGroups.length > 0;
  const emailsAvailableCount = resolveResult?.summary.eligible ?? 0;

  const buildAudienceFilterPayload = useCallback(() => {
    if (audienceMode === 'emails') {
      return {
        audienceMode: 'emails' as const,
        includeContactIds: [...manualIncludeIds],
      };
    }
    if (audienceMode === 'tags') {
      return {
        audienceMode: 'tags' as const,
        tagIds,
        excludeTagIds,
      };
    }
    return {
      audienceMode: 'groups' as const,
      groupOptionIds,
      excludeGroupOptionIds,
    };
  }, [
    audienceMode,
    excludeGroupOptionIds,
    excludeTagIds,
    groupOptionIds,
    manualIncludeIds,
    tagIds,
  ]);

  const audienceSelectionFilled = useMemo(() => {
    if (audienceMode === 'groups') {
      return groupOptionIds.length > 0
        || excludeGroupOptionIds.length > 0
        || Boolean(preview);
    }
    if (audienceMode === 'tags') {
      return tagIds.length > 0 || excludeTagIds.length > 0 || Boolean(preview);
    }
    return Boolean(pasteText.trim()) || Boolean(resolveResult) || manualIncludeIds.size > 0;
  }, [
    audienceMode,
    excludeGroupOptionIds.length,
    excludeTagIds.length,
    groupOptionIds.length,
    manualIncludeIds.size,
    pasteText,
    preview,
    resolveResult,
    tagIds.length,
  ]);
  const effectiveName = (
    name.trim()
    || selectedNewsletter?.title
    || `Envío ${new Date().toLocaleString('es-PE')}`
  ).trim();

  const previewUniverse = audienceMode === 'emails'
    ? (preview?.eligible ?? emailsAvailableCount)
    : (preview?.eligible ?? 0);
  const selectedCount = audienceMode === 'emails'
    ? manualIncludeIds.size
    : preview
      ? recipientSelectionMode === 'all'
        ? Math.max(0, preview.eligible - manualExcludeIds.size)
        : manualIncludeIds.size
      : 0;
  const audienceReady = Boolean(preview && preview.eligible > 0 && selectedCount > 0);
  const senderReady = Boolean(
    fromName.trim()
      && senderEmails.includes(fromEmail)
      && maliPeEmailPattern.test(replyTo.trim()),
  );
  const contentReady = Boolean(selectedNewsletter)
    && Boolean(subject.trim())
    && effectiveName.length >= 3;
  const scheduleReady = scheduleMode === 'now' || Boolean(
    scheduledAt && new Date(limaDateTimeToIso(scheduledAt)).getTime() > Date.now(),
  );
  const campaignReady = audienceReady && senderReady && contentReady && scheduleReady;
  const stepIndex = CAMPAIGN_STEPS.findIndex((step) => step.id === formStep);
  const stepReady: Record<CampaignStepId, boolean> = {
    to: audienceReady,
    from: senderReady,
    content: contentReady,
    send: scheduleReady,
  };
  const stepBlockReason: Partial<Record<CampaignStepId, string>> = {
    to: audienceMode === 'groups' && !groupOptionIds.length
      ? 'Selecciona al menos una opción para incluir'
      : audienceMode === 'tags' && !tagIds.length
        ? 'Selecciona al menos una etiqueta para incluir'
        : audienceMode === 'emails' && !resolveResult
          ? 'Revisa la lista de correos para continuar'
          : audienceMode === 'emails' && resolveResult && !resolveResult.summary.eligible
            ? 'No hay contactos listos para enviar en la lista'
            : resolveBusy || previewBusy
              ? 'Calculando destinatarios…'
              : audienceMode !== 'emails' && !preview
                ? 'Muestra los destinatarios para continuar'
                : !previewUniverse
                  ? 'No hay contactos disponibles con estos filtros'
                  : !selectedCount
                    ? 'Selecciona al menos un destinatario'
                    : undefined,
    from: !senderEmails.length
      ? 'No hay remitentes configurados'
      : !fromName.trim()
        ? 'Indica el nombre visible del remitente'
        : !senderEmails.includes(fromEmail)
          ? 'Elige un correo de remitente'
          : !maliPeEmailPattern.test(replyTo.trim())
            ? 'El correo de respuesta debe ser @mali.pe'
            : undefined,
    content: !selectedNewsletter
      ? 'Elige o crea el contenido del boletín'
      : !subject.trim()
        ? 'Escribe el asunto del correo'
        : effectiveName.length < 3
          ? 'El nombre del envío debe tener al menos 3 caracteres'
          : undefined,
    send: scheduleMode === 'scheduled' && !scheduleReady
      ? 'Indica una fecha y hora futura en Lima'
      : undefined,
  };

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const [nextCampaigns, nextNewsletters] = await Promise.all([
        api.listMalichimpCampaigns(),
        api.listMalichimpNewsletters(),
      ]);
      setCampaigns(nextCampaigns);
      setNewsletters(nextNewsletters);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las campañas');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!open) return;
    try {
      const stored = sessionStorage.getItem(PASTE_STORAGE_KEY);
      if (stored !== null) setPasteText(stored);
    } catch {
      /* ignore */
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    try {
      if (pasteText.trim()) sessionStorage.setItem(PASTE_STORAGE_KEY, pasteText);
      else sessionStorage.removeItem(PASTE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [open, pasteText]);
  useEffect(() => {
    const timer = window.setInterval(() => void load(true), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (loading) return;
    if (openNew) {
      resetForm();
      setOpen(true);
      onDeepLinkConsumed?.(['new']);
      return;
    }
    if (openCampaignId) {
      const target = campaigns.find((row) => row.id === openCampaignId);
      onDeepLinkConsumed?.(['campaign']);
      if (target?.status === 'draft') {
        void continueDraft(openCampaignId);
      } else if (target) {
        void openCampaignPreview(openCampaignId);
      } else {
        toast.error('No se encontró la campaña');
      }
    }
    // Intentionally only when deep-link flags change after load.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deep-link one-shot
  }, [loading, openNew, openCampaignId]);
  useEffect(() => {
    if (!preview) {
      setDebouncedRecipientQuery(recipientQuery.trim());
      return;
    }
    const timer = window.setTimeout(() => {
      const q = recipientQuery.trim();
      setDebouncedRecipientQuery(q);
      void loadAudiencePage(1, { resetSelection: false, notify: false, q });
    }, 300);
    return () => window.clearTimeout(timer);
    // Debounced search while the audience preview is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [recipientQuery]);

  function resetForm() {
    setDraftCampaignId(null);
    setAttachedNewsletter(null);
    setDraftNewsletterId(null);
    setContentRevision(null);
    setShowAdvancedSender(false);
    setName('');
    setNewsletterId('');
    setSubject('');
    setFromName('Museo de Arte de Lima');
    setFromEmail(defaultSenderEmail);
    setReplyTo(defaultSenderEmail);
    setAudienceMode('groups');
    setGroupOptionIds([]);
    setExcludeGroupOptionIds([]);
    setTagIds([]);
    setExcludeTagIds([]);
    setPasteText('');
    setResolveResult(null);
    setResolveBusy(false);
    setResolveTouched(false);
    setShowGroupExclude(false);
    setShowTagExclude(false);
    setExpandedResolveBuckets(new Set());
    clearPasteSession();
    setScheduleMode('now');
    setScheduledAt('');
    setPreview(null);
    setRecipientSelectionMode('all');
    setManualExcludeIds(new Set());
    setManualIncludeIds(new Set());
    setRecipientQuery('');
    setDebouncedRecipientQuery('');
    setFormStep('to');
  }

  function clearAudienceModeData(mode: MalichimpAudienceMode) {
    if (mode === 'groups') {
      setGroupOptionIds([]);
      setExcludeGroupOptionIds([]);
      setShowGroupExclude(false);
    } else if (mode === 'tags') {
      setTagIds([]);
      setExcludeTagIds([]);
      setShowTagExclude(false);
    } else {
      setPasteText('');
      setResolveResult(null);
      setResolveTouched(false);
      setExpandedResolveBuckets(new Set());
      clearPasteSession();
    }
    clearAudiencePreview();
  }

  async function requestAudienceModeChange(next: MalichimpAudienceMode) {
    if (next === audienceMode) return;
    if (!audienceSelectionFilled) {
      clearAudienceModeData(audienceMode);
      setAudienceMode(next);
      return;
    }
    const keep = await confirm({
      title: '¿Cambiar la forma de seleccionar la audiencia?',
      description: 'Se borrará la selección actual.',
      confirmLabel: 'Cambiar y borrar',
      cancelLabel: 'Mantener selección',
    });
    if (!keep) return;
    clearAudienceModeData(audienceMode);
    setAudienceMode(next);
  }

  function applyAudiencePreview(
    next: MalichimpAudiencePreviewDto,
    options?: { resetSelection?: boolean },
  ) {
    setPreview(next);
    if (options?.resetSelection !== false) {
      setRecipientSelectionMode('all');
      setManualExcludeIds(new Set());
      setManualIncludeIds(new Set());
    }
  }

  function clearAudiencePreview() {
    setPreview(null);
    setRecipientSelectionMode('all');
    setManualExcludeIds(new Set());
    setManualIncludeIds(new Set());
    setRecipientQuery('');
    setDebouncedRecipientQuery('');
  }

  function isRecipientSelected(id: string) {
    if (audienceMode === 'emails' || recipientSelectionMode === 'none') {
      return manualIncludeIds.has(id);
    }
    return !manualExcludeIds.has(id);
  }

  function toggleRecipient(id: string) {
    if (audienceMode === 'emails' || recipientSelectionMode === 'none') {
      setManualIncludeIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      return;
    }
    if (recipientSelectionMode === 'all') {
      setManualExcludeIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      return;
    }
    setManualIncludeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllRecipients() {
    if (audienceMode === 'emails' && resolveResult) {
      setRecipientSelectionMode('none');
      setManualIncludeIds(new Set(resolveResult.eligible.map((row) => row.id)));
      setManualExcludeIds(new Set());
      return;
    }
    setRecipientSelectionMode('all');
    setManualExcludeIds(new Set());
    setManualIncludeIds(new Set());
  }

  function selectNoRecipients() {
    if (audienceMode === 'emails') {
      setRecipientSelectionMode('none');
      setManualIncludeIds(new Set());
      setManualExcludeIds(new Set());
      return;
    }
    setRecipientSelectionMode('none');
    setManualExcludeIds(new Set());
    setManualIncludeIds(new Set());
  }

  function goNext() {
    const current = CAMPAIGN_STEPS[stepIndex];
    if (!current) return;
    if (!stepReady[current.id]) {
      const reason = stepBlockReason[current.id];
      if (reason) toast.error(reason);
      return;
    }
    const next = CAMPAIGN_STEPS[stepIndex + 1];
    if (next) setFormStep(next.id);
  }

  function goBack() {
    const prev = CAMPAIGN_STEPS[stepIndex - 1];
    if (prev) setFormStep(prev.id);
  }

  function openCampaign() {
    resetForm();
    setOpen(true);
  }

  function selectNewsletter(value: string) {
    const newsletter = selectableNewsletters.find((item) => item.id === value);
    setNewsletterId(value);
    if (!draftCampaignId) {
      setDraftNewsletterId(null);
      setContentRevision(null);
    }
    setSubject((current) => !current.trim() || current === selectedNewsletter?.subject
      ? newsletter?.subject ?? ''
      : current);
    setName((current) => !current.trim() || current === selectedNewsletter?.title
      ? newsletter?.title ?? ''
      : current);
  }

  function setIncludeIds(next: string[]) {
    setGroupOptionIds(next);
    setExcludeGroupOptionIds((current) => current.filter((id) => !next.includes(id)));
    clearAudiencePreview();
  }

  function setExcludeIds(next: string[]) {
    setExcludeGroupOptionIds(next.filter((id) => !groupOptionIds.includes(id)));
    clearAudiencePreview();
  }

  function setTagIncludeIds(next: string[]) {
    setTagIds(next);
    setExcludeTagIds((current) => current.filter((id) => !next.includes(id)));
    clearAudiencePreview();
  }

  function setTagExcludeIds(next: string[]) {
    setExcludeTagIds(next.filter((id) => !tagIds.includes(id)));
    clearAudiencePreview();
  }

  function selectFromEmail(value: string) {
    setReplyTo((current) => !current || current === fromEmail ? value : current);
    setFromEmail(value);
  }

  async function hydrateDraftCampaign(detail: MalichimpCampaignDetailDto) {
    setDraftCampaignId(detail.id);
    setAttachedNewsletter(detail.newsletter);
    const workingId =
      detail.workingNewsletterId ||
      (detail.newsletter.status === 'draft' ? detail.newsletter.id : null);
    setDraftNewsletterId(workingId);
    setContentRevision(detail.contentRevision ?? null);
    setName(detail.name);
    setNewsletterId(workingId || detail.newsletterId);
    setSubject(detail.subject);
    setFromName(detail.fromName);
    setFromEmail(detail.fromEmail);
    setReplyTo(detail.replyTo);
    const mode = detail.audienceMode ?? 'groups';
    setAudienceMode(mode);
    setGroupOptionIds(detail.groupOptionIds);
    setExcludeGroupOptionIds(detail.excludeGroupOptionIds);
    setTagIds(detail.tagIds);
    setExcludeTagIds(detail.excludeTagIds);
    setShowGroupExclude(detail.excludeGroupOptionIds.length > 0);
    setShowTagExclude(detail.excludeTagIds.length > 0);
    setPasteText('');
    setResolveTouched(false);
    setExpandedResolveBuckets(new Set());
    clearPasteSession();

    const includeIds = detail.includeContactIds ?? [];
    const excludeIds = detail.excludeContactIds ?? [];

    if (mode === 'emails') {
      const contacts = detail.includeContacts ?? [];
      const effectiveIds = includeIds.length ? includeIds : contacts.map((row) => row.id);
      setResolveResult({
        eligible: contacts,
        notFound: [],
        invalid: [],
        blocked: [],
        summary: {
          received: contacts.length,
          unique: contacts.length,
          eligible: contacts.length,
          notFound: 0,
          invalid: 0,
          blocked: 0,
        },
      });
      setRecipientSelectionMode('none');
      setManualIncludeIds(new Set(effectiveIds));
      setManualExcludeIds(new Set());
    } else if (includeIds.length) {
      setRecipientSelectionMode('none');
      setManualIncludeIds(new Set(includeIds));
      setManualExcludeIds(new Set());
    } else {
      setRecipientSelectionMode('all');
      setManualExcludeIds(new Set(excludeIds));
      setManualIncludeIds(new Set());
      setResolveResult(null);
    }
    setRecipientQuery('');
    setDebouncedRecipientQuery('');
    setScheduleMode('now');
    setScheduledAt('');
    setShowAdvancedSender(detail.replyTo !== detail.fromEmail);
    setFormStep('to');
    setOpen(true);
    setPreviewBusy(true);
    try {
      const previewPayload = mode === 'emails'
        ? {
            audienceMode: 'emails' as const,
            includeContactIds: includeIds.length
              ? includeIds
              : (detail.includeContacts ?? []).map((row) => row.id),
          }
        : mode === 'tags'
          ? {
              audienceMode: 'tags' as const,
              tagIds: detail.tagIds,
              excludeTagIds: detail.excludeTagIds,
            }
          : {
              audienceMode: 'groups' as const,
              groupOptionIds: detail.groupOptionIds,
              excludeGroupOptionIds: detail.excludeGroupOptionIds,
            };
      const next = await api.previewMalichimpAudience({
        ...previewPayload,
        page: 1,
        pageSize: RECIPIENT_PAGE_SIZE,
      });
      setPreview(next);
    } catch (reason) {
      clearAudiencePreview();
      toast.error(reason instanceof Error ? reason.message : 'No se pudo recalcular la audiencia');
    } finally {
      setPreviewBusy(false);
    }
  }

  async function continueDraft(campaignId: string) {
    setOpeningDraftId(campaignId);
    try {
      await hydrateDraftCampaign(await api.getMalichimpCampaign(campaignId));
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo abrir el borrador');
    } finally {
      setOpeningDraftId(null);
    }
  }

  async function duplicateCampaign(campaignId: string) {
    setDuplicatingId(campaignId);
    try {
      const draft = await api.duplicateMalichimpCampaign(campaignId);
      await load(true);
      toast.success('Campaña duplicada como borrador');
      await hydrateDraftCampaign(draft);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo duplicar la campaña');
    } finally {
      setDuplicatingId(null);
    }
  }

  async function deleteDraftCampaign(campaign: MalichimpCampaignDto) {
    const ok = await confirm({
      title: `¿Eliminar el borrador “${campaign.name}”?`,
      description:
        'Si el boletín solo lo usaba esta campaña y sigue en borrador, también se eliminará.',
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    setDeletingId(campaign.id);
    try {
      await api.deleteMalichimpCampaign(campaign.id);
      if (draftCampaignId === campaign.id) {
        setOpen(false);
        resetForm();
      }
      await load(true);
      toast.success('Borrador eliminado');
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo eliminar');
    } finally {
      setDeletingId(null);
    }
  }

  async function openCampaignPreview(campaignId: string) {
    setPreviewCampaignId(campaignId);
    try {
      setCampaignPreview(await api.getMalichimpCampaign(campaignId));
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo cargar la vista previa');
    } finally {
      setPreviewCampaignId(null);
    }
  }

  async function refreshAttachedNewsletter() {
    const newsletterToRefresh = draftNewsletterId || attachedNewsletter?.id || newsletterId;
    if (!newsletterToRefresh) return;
    setRefreshingContent(true);
    try {
      if (draftCampaignId) {
        const detail = await api.getMalichimpCampaign(draftCampaignId);
        setAttachedNewsletter(detail.newsletter);
        setContentRevision(detail.contentRevision ?? null);
        if (detail.workingNewsletterId) {
          setDraftNewsletterId(detail.workingNewsletterId);
          setNewsletterId(detail.workingNewsletterId);
        }
      } else {
        const content = await api.getMalichimpContent(newsletterToRefresh);
        setAttachedNewsletter(content);
        setContentRevision(content.contentRevisionToken ?? null);
      }
      toast.success('Vista previa actualizada');
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo actualizar el contenido');
    } finally {
      setRefreshingContent(false);
    }
  }

  async function loadAudiencePage(
    page: number,
    options?: {
      resetSelection?: boolean;
      notify?: boolean;
      q?: string;
      includeContactIds?: string[];
    },
  ) {
    if (audienceMode === 'groups' && !groupOptionIds.length) {
      toast.error('Selecciona al menos una opción para incluir');
      return;
    }
    if (audienceMode === 'tags' && !tagIds.length) {
      toast.error('Selecciona al menos una etiqueta para incluir');
      return;
    }
    const emailIncludeIds = options?.includeContactIds ?? [...manualIncludeIds];
    if (audienceMode === 'emails' && !emailIncludeIds.length) {
      toast.error('No hay contactos listos para enviar');
      return;
    }
    const q = (options?.q ?? debouncedRecipientQuery).trim();
    setPreviewBusy(true);
    try {
      const filterPayload = audienceMode === 'emails'
        ? {
            audienceMode: 'emails' as const,
            includeContactIds: emailIncludeIds,
          }
        : buildAudienceFilterPayload();
      const next = await api.previewMalichimpAudience({
        ...filterPayload,
        page,
        pageSize: RECIPIENT_PAGE_SIZE,
        ...(q ? { q } : {}),
      });
      applyAudiencePreview(next, { resetSelection: options?.resetSelection });
      if (options?.notify !== false) {
        toast.success(
          audienceMode === 'emails'
            ? `${nf.format(next.eligible)} contactos listos para enviar`
            : `${nf.format(next.eligible)} contactos disponibles`,
        );
      }
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo calcular la audiencia');
    } finally {
      setPreviewBusy(false);
    }
  }

  async function calculateAudience() {
    setRecipientQuery('');
    setDebouncedRecipientQuery('');
    await loadAudiencePage(1, { resetSelection: true, notify: true, q: '' });
  }

  async function reviewEmailList() {
    const emails = parsePastedEmails(pasteText);
    if (!emails.length) {
      toast.error('Pega al menos un correo');
      return;
    }
    if (emails.length > MAX_PASTE_EMAILS) {
      toast.error(`La lista no puede superar ${nf.format(MAX_PASTE_EMAILS)} correos únicos`);
      return;
    }
    setResolveBusy(true);
    setResolveTouched(true);
    try {
      const result = await api.resolveMalichimpEmails(emails);
      setResolveResult(result);
      const ids = result.eligible.map((row) => row.id);
      setRecipientSelectionMode('none');
      setManualIncludeIds(new Set(ids));
      setManualExcludeIds(new Set());
      clearAudiencePreview();
      if (ids.length) {
        await loadAudiencePage(1, {
          resetSelection: false,
          notify: false,
          q: '',
          includeContactIds: ids,
        });
      }
    } catch (reason) {
      setResolveResult(null);
      toast.error(reason instanceof Error ? reason.message : 'No se pudo revisar la lista');
    } finally {
      setResolveBusy(false);
    }
  }

  function toggleResolveBucket(bucket: 'notFound' | 'invalid' | 'blocked') {
    setExpandedResolveBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(bucket)) next.delete(bucket);
      else next.add(bucket);
      return next;
    });
  }

  const audienceConfirmSummary = useMemo(() => {
    const lines: string[] = [];
    if (audienceMode === 'groups') {
      lines.push(
        `Audiencia: ${nf.format(groupOptionIds.length)} opción${groupOptionIds.length === 1 ? '' : 'es'}`,
      );
      lines.push('Criterio: pertenecer al menos a una');
      if (excludeGroupOptionIds.length) {
        lines.push(
          `Exclusiones: ${nf.format(excludeGroupOptionIds.length)} opción${excludeGroupOptionIds.length === 1 ? '' : 'es'}`,
        );
      }
    } else if (audienceMode === 'tags') {
      lines.push(
        `Audiencia: ${nf.format(tagIds.length)} etiqueta${tagIds.length === 1 ? '' : 's'}`,
      );
      lines.push('Criterio: pertenecer al menos a una');
      if (excludeTagIds.length) {
        lines.push(
          `Exclusiones: ${nf.format(excludeTagIds.length)} etiqueta${excludeTagIds.length === 1 ? '' : 's'}`,
        );
      }
    } else {
      lines.push(
        `Audiencia: ${nf.format(selectedCount)} correo${selectedCount === 1 ? '' : 's'}`,
      );
    }
    lines.push(`Destinatarios: ${nf.format(selectedCount)}`);
    lines.push(`Contenido: ${selectedNewsletter?.title || effectiveName}`);
    lines.push(
      scheduleMode === 'scheduled' && scheduledAt
        ? `Envío: ${df.format(new Date(limaDateTimeToIso(scheduledAt)))}`
        : 'Envío: Ahora',
    );
    return lines;
  }, [
    audienceMode,
    effectiveName,
    excludeGroupOptionIds.length,
    excludeTagIds.length,
    groupOptionIds.length,
    scheduledAt,
    scheduleMode,
    selectedCount,
    selectedNewsletter?.title,
    tagIds.length,
  ]);

  async function submitCampaign() {
    if (!campaignReady || !preview || !selectedCount) return;
    const excludeContactIds = audienceMode !== 'emails' && recipientSelectionMode === 'all'
      ? [...manualExcludeIds]
      : [];
    const includeContactIds = audienceMode === 'emails' || recipientSelectionMode === 'none'
      ? [...manualIncludeIds]
      : [];
    const when = scheduleMode === 'scheduled' && scheduledAt
      ? `programada para ${df.format(new Date(limaDateTimeToIso(scheduledAt)))}`
      : 'envío inmediato';
    const manualNote = audienceMode !== 'emails' && recipientSelectionMode === 'all' && excludeContactIds.length
      ? ` · ${nf.format(excludeContactIds.length)} excluido(s) a mano`
      : audienceMode !== 'emails' && recipientSelectionMode === 'none'
        ? ` · selección manual de ${nf.format(includeContactIds.length)}`
        : '';
    const ok = await confirm({
      title: scheduleMode === 'scheduled' ? 'Programar campaña' : 'Enviar campaña',
      description: [
        ...audienceConfirmSummary,
        '',
        `Se creará la campaña (${when}) hacia ${nf.format(selectedCount)} destinatarios${manualNote}.`,
      ].join('\n'),
      confirmLabel: scheduleMode === 'scheduled' ? 'Programar' : 'Enviar',
    });
    if (!ok) return;

    setBusy(true);
    try {
      const audiencePayload = buildAudienceFilterPayload();
      const payload = {
        name: effectiveName,
        newsletterId,
        ...(contentRevision ? { contentRevision } : {}),
        subject: subject.trim(),
        fromName: fromName.trim(),
        fromEmail,
        replyTo: replyTo.trim(),
        ...audiencePayload,
        ...(audienceMode === 'emails'
          ? { includeContactIds }
          : {
              ...(excludeContactIds.length ? { excludeContactIds } : {}),
              ...(includeContactIds.length ? { includeContactIds } : {}),
            }),
        ...(scheduleMode === 'scheduled' && scheduledAt
          ? { scheduledAt: limaDateTimeToIso(scheduledAt) }
          : {}),
      };
      const result = draftCampaignId
        ? await api.sendMalichimpDraftCampaign(draftCampaignId, payload)
        : await api.createMalichimpCampaign(payload);
      toast.success(
        result.status === 'scheduled'
          ? `Campaña programada para ${nf.format(result.totalRecipients)} destinatarios`
          : `Campaña encolada para ${nf.format(result.totalRecipients)} destinatarios`,
      );
      setOpen(false);
      resetForm();
      await load(true);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo crear la campaña');
    } finally {
      setBusy(false);
    }
  }

  const testReady = senderReady && contentReady && Boolean(delivery?.configured)
    && maliPeEmailPattern.test(sessionEmail);

  function openTestDialog() {
    if (!testReady) return;
    setTestQuery('');
    setTestSelected(sessionEmail ? [sessionEmail] : []);
    setTestOpen(true);
  }

  useEffect(() => {
    if (!testOpen) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setTestLoading(true);
      void api.listMalichimpTestRecipients(testQuery.trim() || undefined)
        .then((items) => {
          if (!cancelled) setTestRecipients(items);
        })
        .catch((reason) => {
          if (!cancelled) {
            toast.error(reason instanceof Error ? reason.message : 'No se pudo cargar el directorio');
            setTestRecipients([]);
          }
        })
        .finally(() => {
          if (!cancelled) setTestLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [testOpen, testQuery, toast]);

  async function submitTestSend() {
    if (!testReady || !selectedNewsletter) return;
    const emails = [...new Set([sessionEmail, ...testSelected].filter(Boolean))];
    if (!emails.length) {
      toast.error('Incluye al menos tu correo @mali.pe');
      return;
    }
    if (emails.length > 5) {
      toast.error('Máximo 5 destinatarios de prueba');
      return;
    }
    setTestBusy(true);
    try {
      const result = await api.sendMalichimpTestCampaign({
        ...(draftCampaignId ? { campaignId: draftCampaignId } : {}),
        name: effectiveName,
        newsletterId,
        ...(contentRevision ? { contentRevision } : {}),
        subject: subject.trim(),
        fromName: fromName.trim(),
        fromEmail,
        replyTo: replyTo.trim(),
        emails,
      });
      setDraftCampaignId(result.campaignId);
      try {
        const detail = await api.getMalichimpCampaign(result.campaignId);
        setAttachedNewsletter(detail.newsletter);
        setContentRevision(detail.contentRevision ?? null);
        if (detail.workingNewsletterId) {
          setDraftNewsletterId(detail.workingNewsletterId);
          setNewsletterId(detail.workingNewsletterId);
        }
      } catch {
        /* revision refresh is best-effort; next Actualizar recovers */
      }
      const sent = result.sends.filter((row) => row.status === 'sent').length;
      const failed = result.sends.filter((row) => row.status === 'failed').length;
      toast.success(
        failed
          ? `Prueba: ${nf.format(sent)} enviada(s), ${nf.format(failed)} fallida(s)`
          : `Prueba enviada a ${nf.format(sent)} destinatario(s)`,
      );
      setTestOpen(false);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo enviar la prueba');
    } finally {
      setTestBusy(false);
    }
  }

  if (loading) return <TableShellSkeleton rows={5} cols={7} />;

  return (
    <div className="space-y-4">
      {error ? <AlertBanner>{error}</AlertBanner> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Campañas de correo</h2>
          <p className="text-sm text-muted-foreground">
            Cada envío congela el boletín y su audiencia.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} aria-label="Actualizar campañas">
            <RefreshCw className="size-4" aria-hidden /> Actualizar
          </Button>
          <Button
            variant="outline"
            disabled={exporting || !campaigns.length}
            onClick={() => {
              void (async () => {
                setExporting(true);
                try {
                  const ids = [...selectedCampaignIds];
                  await api.exportMalichimpCampaigns(ids.length ? ids : undefined);
                  toast.success(
                    ids.length
                      ? `Exportadas ${ids.length} campaña${ids.length === 1 ? '' : 's'}`
                      : 'Exportadas todas las campañas',
                  );
                } catch (reason) {
                  toast.error(reason instanceof Error ? reason.message : 'No se pudo exportar');
                } finally {
                  setExporting(false);
                }
              })();
            }}
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            {selectedCampaignIds.size
              ? `Exportar ${selectedCampaignIds.size}`
              : 'Exportar todas'}
          </Button>
          <Button
            onClick={openCampaign}
            disabled={!delivery?.configured || !hasGroupOptions || !senders.length}
          >
            <Plus className="size-4" aria-hidden /> Nueva campaña
          </Button>
        </div>
      </div>

      {!newsletters.length ? (
        <AlertBanner variant="info">
          No hay contenido disponible. Crea una pieza en la pestaña Contenido o publica un
          boletín en Boletines.
        </AlertBanner>
      ) : null}

      {!hasGroupOptions ? (
        <AlertBanner variant="info">
          Importa la audiencia de Mailchimp para recuperar las opciones de grupo antes de crear campañas.
        </AlertBanner>
      ) : null}

      {!senders.length ? (
        <AlertBanner variant="info">
          Agrega al menos un remitente @mali.pe en Boletines → Remitentes antes de crear campañas.
        </AlertBanner>
      ) : null}

      <TableShell>
        <Table className="min-w-[840px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Seleccionar todas las campañas"
                  checked={
                    campaigns.length > 0 && selectedCampaignIds.size === campaigns.length
                      ? true
                      : selectedCampaignIds.size > 0
                        ? 'indeterminate'
                        : false
                  }
                  onCheckedChange={(checked) => {
                    setSelectedCampaignIds(
                      checked === true
                        ? new Set(campaigns.map((campaign) => campaign.id))
                        : new Set(),
                    );
                  }}
                />
              </TableHead>
              <TableHead className="w-[7.5rem]">Vista</TableHead>
                <TableHead>Campaña</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Enviados</TableHead>
                <TableHead>% entrega</TableHead>
                <TableHead>% apertura</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="align-middle">
                    <Checkbox
                      aria-label={`Seleccionar ${campaign.name}`}
                      checked={selectedCampaignIds.has(campaign.id)}
                      onCheckedChange={(checked) => {
                        setSelectedCampaignIds((current) => {
                          const next = new Set(current);
                          if (checked === true) next.add(campaign.id);
                          else next.delete(campaign.id);
                          return next;
                        });
                      }}
                    />
                  </TableCell>
                  <TableCell className="align-middle">
                    <button
                      type="button"
                      className="relative block h-16 w-[5.5rem] overflow-hidden rounded-md border bg-white shadow-sm transition-opacity hover:opacity-90"
                      onClick={() => void openCampaignPreview(campaign.id)}
                      aria-label={`Vista previa de ${campaign.name}`}
                      title="Abrir vista previa"
                      disabled={previewCampaignId === campaign.id}
                    >
                      <iframe
                        title={`Miniatura de ${campaign.name}`}
                        src={`/api/malichimp/campaigns/${encodeURIComponent(campaign.id)}/view`}
                        sandbox=""
                        referrerPolicy="no-referrer"
                        tabIndex={-1}
                        loading="lazy"
                        className="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
                        style={{
                          width: 640,
                          height: 900,
                          transform: 'scale(0.1375)',
                        }}
                      />
                    </button>
                  </TableCell>
                  <TableCell className="min-w-64">
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {campaign.newsletterTitle} · {df.format(new Date(campaign.createdAt))}
                    </p>
                    {campaign.createdBy ? (
                      <p className="text-xs text-muted-foreground">
                        Creada por {campaign.createdBy.name || campaign.createdBy.email}
                      </p>
                    ) : null}
                    {campaign.scheduledAt ? (
                      <p className="text-xs text-muted-foreground">
                        Programada: {df.format(new Date(campaign.scheduledAt))}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant={campaign.status === 'failed' ? 'destructive' : campaign.status === 'completed' ? 'default' : 'secondary'}>
                      {statusLabel[campaign.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{nf.format(campaign.sent)} / {nf.format(campaign.totalRecipients)}</TableCell>
                  <TableCell className="tabular-nums">
                    {pf.format(
                      campaign.sent > 0
                        ? campaign.delivered / campaign.sent
                        : 0,
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {pf.format(
                      campaign.delivered > 0
                        ? campaign.opened / campaign.delivered
                        : 0,
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                      <IconActionButton
                        label="Estadísticas"
                        onClick={() => setStatsCampaign(campaign)}
                      >
                        <BarChart3 className="size-4" />
                      </IconActionButton>
                      {campaign.status === 'draft' ? (
                        <IconActionButton
                          label="Continuar"
                          onClick={() => void continueDraft(campaign.id)}
                          disabled={openingDraftId === campaign.id}
                        >
                          {openingDraftId === campaign.id ? (
                            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                          ) : (
                            <Pencil className="size-4" aria-hidden />
                          )}
                        </IconActionButton>
                      ) : null}
                      <IconActionButton
                        label="Ver"
                        href={`/api/malichimp/campaigns/${encodeURIComponent(campaign.id)}/view`}
                      >
                        <ExternalLink className="size-4" aria-hidden />
                      </IconActionButton>
                      <IconActionButton
                        label="Duplicar"
                        onClick={() => void duplicateCampaign(campaign.id)}
                        disabled={duplicatingId === campaign.id}
                      >
                        {duplicatingId === campaign.id ? (
                          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                        ) : (
                          <Copy className="size-4" aria-hidden />
                        )}
                      </IconActionButton>
                      {campaign.status === 'draft' ? (
                        <IconActionButton
                          label="Eliminar"
                          onClick={() => void deleteDraftCampaign(campaign)}
                          disabled={deletingId === campaign.id}
                        >
                          {deletingId === campaign.id ? (
                            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                          ) : (
                            <Trash2 className="size-4" aria-hidden />
                          )}
                        </IconActionButton>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!campaigns.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    <BarChart3 className="mx-auto mb-2 size-6" aria-hidden />
                    Aún no hay campañas MALICHIMP.
                  </TableCell>
                </TableRow>
              ) : null}
          </TableBody>
        </Table>
      </TableShell>

      <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetForm(); }}>
        <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-5 pb-4 pt-5 sm:px-6">
            <DialogTitle>
              {draftCampaignId ? 'Continuar campaña' : 'Nueva campaña'}
            </DialogTitle>
            <DialogDescription>
              Paso {stepIndex + 1} de {CAMPAIGN_STEPS.length}: {CAMPAIGN_STEPS[stepIndex]?.hint}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-auto overflow-y-auto p-5 sm:p-6">
            {formStep === 'to' ? (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-base font-medium">Para</h3>
                  <p className="text-sm text-muted-foreground">
                    Define quién recibirá este envío.
                  </p>
                </div>

                <AudienceModeRadioCards
                  value={audienceMode}
                  onChange={(mode) => void requestAudienceModeChange(mode)}
                />

                {audienceMode === 'groups' ? (
                  <div className="space-y-4">
                    <GroupOptionMultiSelect
                      id="malichimp-include"
                      label="Opciones a incluir"
                      hint="Se incluirán contactos que pertenezcan a al menos una de las opciones seleccionadas."
                      options={flatOptions}
                      selectedIds={groupOptionIds}
                      onChange={setIncludeIds}
                      placeholder="Seleccionar opciones"
                    />
                    <div className="rounded-md border border-dashed">
                      <button
                        type="button"
                        className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
                        onClick={() => setShowGroupExclude((value) => !value)}
                        aria-expanded={showGroupExclude}
                      >
                        <span className="font-medium">Excluir opciones (opcional)</span>
                        <ChevronDown
                          className={cn(
                            'size-4 shrink-0 text-muted-foreground transition-transform',
                            showGroupExclude && 'rotate-180',
                          )}
                          aria-hidden
                        />
                      </button>
                      {showGroupExclude ? (
                        <div className="border-t px-3 pb-3 pt-2">
                          <GroupOptionMultiSelect
                            id="malichimp-exclude"
                            label="Opciones a excluir"
                            options={flatOptions}
                            selectedIds={excludeGroupOptionIds}
                            disabledIds={groupOptionIds}
                            onChange={setExcludeIds}
                            placeholder="Ninguna exclusión"
                          />
                        </div>
                      ) : null}
                    </div>
                    {!hasGroupOptions ? (
                      <p className="text-sm text-muted-foreground">
                        No hay opciones de grupo configuradas en la audiencia.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {audienceMode === 'tags' ? (
                  <div className="space-y-4">
                    <GroupOptionMultiSelect
                      id="malichimp-tags-include"
                      label="Etiquetas a incluir"
                      hint="Se incluirán contactos que pertenezcan a al menos una de las etiquetas seleccionadas."
                      options={tagFlatOptions}
                      selectedIds={tagIds}
                      onChange={setTagIncludeIds}
                      placeholder="Seleccionar etiquetas"
                    />
                    <div className="rounded-md border border-dashed">
                      <button
                        type="button"
                        className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
                        onClick={() => setShowTagExclude((value) => !value)}
                        aria-expanded={showTagExclude}
                      >
                        <span className="font-medium">Excluir etiquetas (opcional)</span>
                        <ChevronDown
                          className={cn(
                            'size-4 shrink-0 text-muted-foreground transition-transform',
                            showTagExclude && 'rotate-180',
                          )}
                          aria-hidden
                        />
                      </button>
                      {showTagExclude ? (
                        <div className="border-t px-3 pb-3 pt-2">
                          <GroupOptionMultiSelect
                            id="malichimp-tags-exclude"
                            label="Etiquetas a excluir"
                            options={tagFlatOptions}
                            selectedIds={excludeTagIds}
                            disabledIds={tagIds}
                            onChange={setTagExcludeIds}
                            placeholder="Ninguna exclusión"
                          />
                        </div>
                      ) : null}
                    </div>
                    {!tags.length ? (
                      <p className="text-sm text-muted-foreground">
                        Aún no hay etiquetas en la audiencia.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {audienceMode === 'emails' ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="malichimp-paste-emails">Lista de correos</Label>
                      <p className="text-xs text-muted-foreground">
                        Pega los correos separados por línea, coma o punto y coma.
                      </p>
                      <Textarea
                        id="malichimp-paste-emails"
                        value={pasteText}
                        onChange={(event) => setPasteText(event.target.value)}
                        rows={8}
                        className="font-mono text-sm"
                        placeholder="correo1@ejemplo.com, correo2@ejemplo.com"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={resolveBusy || !pasteText.trim()}
                      onClick={() => void reviewEmailList()}
                    >
                      {resolveBusy ? (
                        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                      ) : null}
                      {resolveBusy
                        ? 'Revisando correos…'
                        : resolveTouched
                          ? 'Revisar lista nuevamente'
                          : 'Revisar lista'}
                    </Button>

                    {resolveResult ? (
                      <div className="space-y-3 rounded-md border bg-muted/20 px-3 py-3 text-sm">
                        <p className="font-medium">
                          {nf.format(resolveResult.summary.eligible)} listos para enviar
                        </p>
                        <p className="text-muted-foreground">
                          {resolveResult.summary.notFound
                            ? `${nf.format(resolveResult.summary.notFound)} no están en MALICHIMP`
                            : null}
                          {resolveResult.summary.notFound && (resolveResult.summary.blocked || resolveResult.summary.invalid)
                            ? ' · '
                            : null}
                          {resolveResult.summary.blocked
                            ? `${nf.format(resolveResult.summary.blocked)} no pueden recibir campañas`
                            : null}
                          {resolveResult.summary.blocked && resolveResult.summary.invalid ? ' · ' : null}
                          {resolveResult.summary.invalid
                            ? `${nf.format(resolveResult.summary.invalid)} necesitan corrección`
                            : null}
                          {!resolveResult.summary.notFound
                            && !resolveResult.summary.blocked
                            && !resolveResult.summary.invalid
                            ? 'Sin incidencias en la lista.'
                            : null}
                        </p>
                        {resolveResult.summary.notFound > 0 ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={openMalichimpAudienceImport}
                          >
                            <ExternalLink className="size-4" aria-hidden />
                            {resolveResult.summary.notFound === 1
                              ? 'Ir a importar 1 contacto'
                              : `Ir a importar ${nf.format(resolveResult.summary.notFound)} contactos`}
                          </Button>
                        ) : null}

                        {resolveResult.summary.notFound > 0 ? (
                          <ResolveBucketSection
                            bucket="notFound"
                            label="No están en MALICHIMP"
                            expanded={expandedResolveBuckets}
                            onToggle={toggleResolveBucket}
                          >
                            <PaginatedStringList items={resolveResult.notFound} />
                          </ResolveBucketSection>
                        ) : null}
                        {resolveResult.summary.invalid > 0 ? (
                          <ResolveBucketSection
                            bucket="invalid"
                            label="Correos que debes revisar"
                            expanded={expandedResolveBuckets}
                            onToggle={toggleResolveBucket}
                          >
                            <PaginatedStringList items={resolveResult.invalid} />
                          </ResolveBucketSection>
                        ) : null}
                        {resolveResult.summary.blocked > 0 ? (
                          <ResolveBucketSection
                            bucket="blocked"
                            label="No pueden recibir campañas"
                            expanded={expandedResolveBuckets}
                            onToggle={toggleResolveBucket}
                          >
                            <PaginatedStringList
                              items={resolveResult.blocked.map((row) => row.email)}
                              renderItem={(email) => {
                                const row = resolveResult.blocked.find((item) => item.email === email);
                                return (
                                  <span className="flex flex-wrap items-baseline gap-2">
                                    <span>{email}</span>
                                    {row ? (
                                      <span className="text-muted-foreground">
                                        ({blockedReasonLabel(row.reason)})
                                      </span>
                                    ) : null}
                                  </span>
                                );
                              }}
                            />
                          </ResolveBucketSection>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {(audienceMode !== 'emails' || resolveResult) ? (
                  <div className="space-y-3 border-t border-border/60 pt-5">
                    {previewUniverse > 0 || preview ? (
                      <p className="text-base font-semibold tracking-tight">
                        Enviarás a{' '}
                        <span className="text-foreground">{nf.format(selectedCount)}</span>
                        {' de '}
                        <span className="text-foreground">{nf.format(previewUniverse)}</span>
                        {' contactos disponibles.'}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Calcula los destinatarios para ver el total disponible.
                      </p>
                    )}

                    {audienceMode !== 'emails' ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={
                            previewBusy
                            || (audienceMode === 'groups' && !groupOptionIds.length)
                            || (audienceMode === 'tags' && !tagIds.length)
                          }
                          onClick={() => void calculateAudience()}
                        >
                          {previewBusy ? (
                            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                          ) : (
                            <Eye className="size-4" aria-hidden />
                          )}
                          {previewBusy ? 'Calculando…' : preview ? 'Recalcular' : 'Mostrar destinatarios'}
                        </Button>
                        {preview && preview.excluded ? (
                          <span className="text-xs text-muted-foreground">
                            {nf.format(preview.excluded)} excluidos por filtro
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {preview && previewUniverse > 0 ? (
                      <div className="space-y-2 rounded-md border border-border/60 bg-muted/10 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          {audienceMode !== 'emails' ? (
                            <div className="flex gap-2">
                              <Button type="button" size="sm" variant="ghost" onClick={selectAllRecipients}>
                                Marcar todos
                              </Button>
                              <Button type="button" size="sm" variant="ghost" onClick={selectNoRecipients}>
                                Ninguno
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Desmarca quien no deba recibir este envío
                            </span>
                          )}
                          {debouncedRecipientQuery ? (
                            <span className="text-xs text-muted-foreground">
                              {nf.format(preview.matched)} coincidencia{preview.matched === 1 ? '' : 's'}
                            </span>
                          ) : null}
                        </div>
                        <div className="relative">
                          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" aria-hidden />
                          <Input
                            value={recipientQuery}
                            onChange={(event) => setRecipientQuery(event.target.value)}
                            placeholder="Buscar por nombre o email"
                            className="pl-8"
                            aria-label="Buscar destinatarios"
                          />
                        </div>
                        <ul className="max-h-72 divide-y overflow-y-auto rounded-md border bg-background text-sm">
                          {preview.recipients.map((row) => {
                            const checked = isRecipientSelected(row.id);
                            const inputId = `malichimp-recipient-${row.id}`;
                            return (
                              <li key={row.id} className="flex items-start gap-3 px-3 py-2">
                                <Checkbox
                                  id={inputId}
                                  checked={checked}
                                  className="mt-0.5"
                                  onCheckedChange={() => toggleRecipient(row.id)}
                                />
                                <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
                                  <span className="block font-medium">{row.name || '—'}</span>
                                  <span className="block font-mono text-xs text-muted-foreground">
                                    {row.email}
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                          {!preview.recipients.length ? (
                            <li className="px-3 py-6 text-center text-muted-foreground">
                              {debouncedRecipientQuery
                                ? 'Sin coincidencias para esta búsqueda'
                                : 'Sin contactos en esta página'}
                            </li>
                          ) : null}
                        </ul>
                        {preview.totalPages > 1 ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span className="text-xs text-muted-foreground">
                              Página {preview.page} de {preview.totalPages}
                            </span>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={previewBusy || preview.page <= 1}
                                onClick={() => void loadAudiencePage(preview.page - 1, {
                                  resetSelection: false,
                                  notify: false,
                                })}
                              >
                                <ChevronLeft className="size-4" aria-hidden />
                                Anterior
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={previewBusy || preview.page >= preview.totalPages}
                                onClick={() => void loadAudiencePage(preview.page + 1, {
                                  resetSelection: false,
                                  notify: false,
                                })}
                              >
                                Siguiente
                                <ChevronRight className="size-4" aria-hidden />
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : preview ? (
                      <p className="text-sm text-muted-foreground">
                        No hay contactos disponibles con los filtros actuales.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {formStep === 'from' ? (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-base font-medium">De</h3>
                  <p className="text-sm text-muted-foreground">
                    Define quién envía el correo y a dónde llegan las respuestas.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="malichimp-from-email">Remitente</Label>
                    <Select value={fromEmail} onValueChange={selectFromEmail}>
                      <SelectTrigger id="malichimp-from-email" aria-label="Correo del remitente">
                        <SelectValue placeholder="Selecciona un remitente" />
                      </SelectTrigger>
                      <SelectContent>
                        {senders.map((sender) => (
                          <SelectItem key={sender.id} value={sender.email}>{sender.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="malichimp-from-name">Nombre visible</Label>
                    <Input
                      id="malichimp-from-name"
                      value={fromName}
                      onChange={(event) => setFromName(event.target.value)}
                      placeholder="Museo de Arte de Lima"
                      maxLength={160}
                    />
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => setShowAdvancedSender((value) => !value)}
                  >
                    {showAdvancedSender ? 'Ocultar opciones de respuesta' : 'Opciones de respuesta'}
                  </button>
                  {showAdvancedSender ? (
                    <div className="mt-2 space-y-2">
                      <Label htmlFor="malichimp-reply-to">Las respuestas llegarán a</Label>
                      <Input
                        id="malichimp-reply-to"
                        type="email"
                        value={replyTo}
                        onChange={(event) => setReplyTo(event.target.value)}
                        placeholder="correo@mali.pe"
                      />
                      <p className="text-xs text-muted-foreground">Debe ser un correo @mali.pe.</p>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {formStep === 'content' ? (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-base font-medium">Contenido</h3>
                  <p className="text-sm text-muted-foreground">
                    Elige el boletín y define el asunto que verán los destinatarios.
                  </p>
                </div>
                {usingDraftContent && selectedNewsletter ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm">
                    <Badge variant="secondary">Contenido de esta campaña</Badge>
                    <span className="font-medium">{selectedNewsletter.title}</span>
                    <Button type="button" size="sm" variant="outline" asChild>
                      <a
                        href={`/admin/malichimp?tab=content&edit=${encodeURIComponent(selectedNewsletter.id)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Pencil className="size-4" aria-hidden />
                        Editar contenido
                      </a>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void refreshAttachedNewsletter()}
                      disabled={refreshingContent}
                    >
                      {refreshingContent ? (
                        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                      ) : (
                        <RefreshCw className="size-4" aria-hidden />
                      )}
                      Actualizar
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <NewsletterSearchSelect
                      id="malichimp-newsletter"
                      label="Contenido (MALICHIMP o Boletines publicados)"
                      newsletters={selectableNewsletters}
                      value={newsletterId}
                      onChange={selectNewsletter}
                      placeholder="Seleccionar"
                    />
                    {!selectableNewsletters.length ? (
                      <p className="text-sm text-muted-foreground">
                        No hay contenido disponible. Crea una pieza en la pestaña Contenido o
                        publica un boletín en Boletines.
                      </p>
                    ) : null}
                  </div>
                )}
                <div className="space-y-2 border-t border-border/60 pt-5">
                  <Label htmlFor="malichimp-subject">Asunto del correo</Label>
                  <Input
                    id="malichimp-subject"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="Asunto que verán los destinatarios"
                    maxLength={300}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="malichimp-campaign-name">Nombre del envío (opcional)</Label>
                  <Input
                    id="malichimp-campaign-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Si lo dejas vacío, usamos el título del boletín"
                    maxLength={160}
                  />
                  <p className="text-xs text-muted-foreground">
                    Solo se usa internamente para identificar la campaña.
                  </p>
                </div>
              </div>
            ) : null}

            {formStep === 'send' ? (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-base font-medium">Envío</h3>
                  <p className="text-sm text-muted-foreground">
                    Revisa el resumen y envía ahora o programa para más tarde.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11.5rem]">
                  <div className="space-y-3 rounded-md border px-3 py-3 text-sm">
                    <p className="font-medium">
                      Enviarás a {nf.format(selectedCount)} contactos disponibles.
                    </p>
                    <ul className="space-y-1.5 text-muted-foreground">
                      {audienceConfirmSummary.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    <p>
                      <span className="text-muted-foreground">De:</span>{' '}
                      {fromName.trim() || '—'} &lt;{fromEmail || '—'}&gt;
                    </p>
                    <p>
                      <span className="text-muted-foreground">Asunto:</span>{' '}
                      {subject.trim() || '—'}
                    </p>
                  </div>
                  <div className="overflow-hidden rounded-md border bg-white">
                    <p className="border-b px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
                      Vista previa
                    </p>
                    <div className="relative h-48 overflow-hidden bg-white">
                      {selectedNewsletter?.htmlBody ? (
                        <iframe
                          title={`Vista previa de ${selectedNewsletter.title}`}
                          srcDoc={selectedNewsletter.htmlBody}
                          sandbox=""
                          referrerPolicy="no-referrer"
                          tabIndex={-1}
                          className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
                          style={{
                            width: 640,
                            height: 900,
                            transform: 'scale(0.275)',
                          }}
                        />
                      ) : (
                        <p className="flex h-full items-center justify-center px-3 text-center text-xs text-muted-foreground">
                          Sin contenido para previsualizar
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="malichimp-schedule-mode"
                      checked={scheduleMode === 'now'}
                      onChange={() => setScheduleMode('now')}
                    />
                    Enviar ahora
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="malichimp-schedule-mode"
                      checked={scheduleMode === 'scheduled'}
                      onChange={() => setScheduleMode('scheduled')}
                    />
                    Programar envío
                  </label>
                </div>
                {scheduleMode === 'scheduled' ? (
                  <div className="max-w-xs space-y-2">
                    <Label htmlFor="malichimp-scheduled-at">Fecha y hora en Lima</Label>
                    <Input
                      id="malichimp-scheduled-at"
                      type="datetime-local"
                      value={scheduledAt}
                      min={minimumLimaDateTime()}
                      onChange={(event) => setScheduledAt(event.target.value)}
                    />
                  </div>
                ) : null}
                {campaignReady ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden />
                    Lista para confirmar
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {stepBlockReason.send
                      || Object.values(stepBlockReason).find(Boolean)
                      || 'Completa los pasos anteriores'}
                  </span>
                )}
              </div>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 border-t bg-background px-5 py-4 sm:px-6">
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                disabled={stepIndex === 0 || busy}
              >
                <ChevronLeft className="size-4" aria-hidden />
                Atrás
              </Button>
              {formStep === 'send' ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={openTestDialog}
                    disabled={busy || testBusy || !testReady}
                  >
                    <FlaskConical className="size-4" aria-hidden />
                    Enviar prueba
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void submitCampaign()}
                    disabled={busy || !campaignReady}
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                    ) : (
                      <Send className="size-4" aria-hidden />
                    )}
                    {busy
                      ? 'Preparando…'
                      : scheduleMode === 'scheduled'
                        ? 'Programar'
                        : 'Enviar'}
                  </Button>
                </div>
              ) : (
                <Button type="button" onClick={goNext} disabled={busy || !stepReady[formStep]}>
                  Siguiente
                  <ChevronRight className="size-4" aria-hidden />
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={testOpen}
        onOpenChange={(value) => {
          if (!testBusy) setTestOpen(value);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar prueba</DialogTitle>
            <DialogDescription>
              Se envía a correos @mali.pe. Registrará aperturas y clics; no incluirá enlace para
              cancelar la suscripción. Tu usuario queda siempre incluido. Máximo 5 destinatarios.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <p className="font-medium">{user?.name || 'Tu usuario'}</p>
              <p className="text-xs text-muted-foreground">{sessionEmail || 'Sin correo de sesión'}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="malichimp-test-q">Buscar en directorio interno</Label>
              <Input
                id="malichimp-test-q"
                value={testQuery}
                onChange={(event) => setTestQuery(event.target.value)}
                placeholder="nombre o correo"
              />
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-2">
              {testLoading ? (
                <p className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                  <Spinner className="size-4" /> Cargando…
                </p>
              ) : testRecipients.length ? (
                testRecipients.map((recipient) => {
                  const checked = testSelected.includes(recipient.email)
                    || recipient.email === sessionEmail;
                  const locked = recipient.email === sessionEmail;
                  return (
                    <label
                      key={recipient.email}
                      className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={locked || testBusy}
                        onCheckedChange={(value) => {
                          if (locked) return;
                          setTestSelected((current) => {
                            const next = new Set(current);
                            if (value === true) next.add(recipient.email);
                            else next.delete(recipient.email);
                            if (sessionEmail) next.add(sessionEmail);
                            return [...next].slice(0, 5);
                          });
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium">{recipient.name}</span>
                        <span className="block text-xs text-muted-foreground">{recipient.email}</span>
                      </span>
                    </label>
                  );
                })
              ) : (
                <p className="p-2 text-sm text-muted-foreground">Sin resultados</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              {[...new Set([sessionEmail, ...testSelected].filter(Boolean))].length} / 5 seleccionados
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTestOpen(false)} disabled={testBusy}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void submitTestSend()} disabled={testBusy || !testReady}>
              {testBusy ? (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <FlaskConical className="size-4" aria-hidden />
              )}
              Enviar prueba
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(campaignPreview)}
        onOpenChange={(value) => { if (!value) setCampaignPreview(null); }}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-5xl overflow-y-auto p-0">
          {campaignPreview ? (
            <>
              <DialogHeader className="border-b px-5 pb-4 pt-5 sm:px-6">
                <DialogTitle>Vista previa: {campaignPreview.name}</DialogTitle>
                <DialogDescription>
                  {campaignPreview.status === 'draft'
                    ? 'Muestra la versión actual del boletín editable asociado al borrador.'
                    : 'Muestra el HTML congelado para esta campaña, aunque el boletín original haya cambiado.'}
                </DialogDescription>
                <div className="flex flex-wrap gap-x-5 gap-y-1 pt-2 text-sm text-muted-foreground">
                  <span><strong className="text-foreground">Asunto:</strong> {campaignPreview.subject}</span>
                  <span>
                    <strong className="text-foreground">De:</strong>{' '}
                    {campaignPreview.fromName} &lt;{campaignPreview.fromEmail}&gt;
                  </span>
                </div>
              </DialogHeader>
              <iframe
                title={`Vista previa de ${campaignPreview.name}`}
                srcDoc={campaignPreview.previewHtml}
                sandbox=""
                referrerPolicy="no-referrer"
                className="h-[min(70vh,720px)] w-full bg-white"
              />
              <DialogFooter className="border-t bg-background px-5 py-4 sm:px-6">
                <Button type="button" variant="outline" asChild>
                  <a
                    href={`/api/malichimp/campaigns/${encodeURIComponent(campaignPreview.id)}/view`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="size-4" aria-hidden />
                    Ver en navegador
                  </a>
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(statsCampaign)}
        onOpenChange={(openDialog) => {
          if (!openDialog) setStatsCampaign(null);
        }}
      >
        <DialogContent className="flex max-h-[min(90vh,900px)] w-[min(calc(100vw-2rem),48rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="shrink-0 border-b px-4 py-4">
            <DialogTitle>Estadísticas de la campaña</DialogTitle>
            <DialogDescription>
              Totales de envío y actividad de aperturas/clics por día
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4">
            {statsCampaign ? (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted">
                    <Spinner /> Cargando estadísticas...
                  </div>
                }
              >
                <MalichimpCampaignStatsPanel
                  campaignId={statsCampaign.id}
                  campaignName={statsCampaign.name}
                />
              </Suspense>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
