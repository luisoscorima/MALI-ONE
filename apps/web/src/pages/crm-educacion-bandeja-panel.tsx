import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CopyableValue } from '@/components/copyable-value';
import { EmptyState, TableShellSkeleton } from '@/components/feedback';
import { useToast } from '@/contexts/toast-context';
import { api, type EducationCategoryScope } from '@/lib/api';
import {
  Badge, Button, DataTable, Input, Label, Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui';

type BandejaRow = Awaited<ReturnType<typeof api.listCrmEducationBandeja>>['items'][number];
type Ficha = Awaited<ReturnType<typeof api.getCrmEducationBandejaFicha>>;

const PAGE_SIZE = 25;

const STAGE_OPTIONS = [
  'por_contactar', 'contactado', 'evaluando', 'promesa', 'venta_exitosa',
  'no_contesta', 'no_interesado', 'perdido',
] as const;

function formatWhen(value: string) {
  return new Date(value).toLocaleString('es-PE', { timeZone: 'America/Lima' });
}

function isPeruPhone(value: string | null | undefined) {
  return Boolean(value?.trim().startsWith('+51'));
}

function PhoneCell({ value, label }: { value: string | null | undefined; label: string }) {
  if (isPeruPhone(value)) return <CopyableValue value={value} label={label} />;
  return <span className="font-mono text-xs">{value?.trim() || '—'}</span>;
}

export function CrmEducacionBandejaPanel({
  categoria,
  onAssociatePayment,
}: {
  categoria: EducationCategoryScope;
  onAssociatePayment?: (waCycleId: number) => void;
}) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [view, setView] = useState('open');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BandejaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [fichaLoading, setFichaLoading] = useState(false);
  const [stageDraft, setStageDraft] = useState('');
  const [advisorDraft, setAdvisorDraft] = useState('');
  const [interestDraft, setInterestDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [slaLine, setSlaLine] = useState<string | null>(null);

  async function load(pageOverride = page) {
    setLoading(true);
    try {
      const data = await api.listCrmEducationBandeja({
        categoria,
        q: q.trim() || undefined,
        view,
        page: pageOverride,
        limit: PAGE_SIZE,
      });
      setRows(data.items);
      setTotal(data.total);
      setPages(data.pages);
      setPage(data.page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar la bandeja');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void api.getCrmEducationSla({ categoria })
      .then((sla) => {
        if (cancelled) return;
        setSlaLine(
          `SLA 1.ª respuesta (proxy WA): promedio ${sla.summary.avg_first_response_minutes} min · ${sla.summary.sla_met_pct}% dentro de SLA · respondidos ${sla.summary.answered_count}`,
        );
      })
      .catch(() => {
        if (!cancelled) setSlaLine(null);
      });
    return () => { cancelled = true; };
  }, [categoria]);

  useEffect(() => {
    setPage(1);
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoria, view]);

  useEffect(() => {
    if (!expandedId) {
      setFicha(null);
      return;
    }
    let cancelled = false;
    setFichaLoading(true);
    void api.getCrmEducationBandejaFicha(expandedId)
      .then((data) => {
        if (cancelled) return;
        setFicha(data);
        const opp = data.opportunity as {
          stage_slug?: string;
          advisor_email?: string | null;
          interest_course?: string | null;
        } | null;
        setStageDraft(opp?.stage_slug ?? '');
        setAdvisorDraft(opp?.advisor_email ?? '');
        setInterestDraft(opp?.interest_course ?? '');
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : 'No se pudo abrir ficha');
      })
      .finally(() => { if (!cancelled) setFichaLoading(false); });
    return () => { cancelled = true; };
  }, [expandedId, toast]);

  const columns = useMemo<ColumnDef<BandejaRow>[]>(() => [
    {
      id: 'when',
      header: 'Fecha',
      cell: ({ row }) => (
        <span className="whitespace-nowrap font-mono text-xs">{formatWhen(row.original.first_seen_at)}</span>
      ),
    },
    {
      id: 'contact',
      header: 'Persona',
      cell: ({ row }) => {
        const name = `${row.original.contacts.name ?? ''} ${row.original.contacts.last_name ?? ''}`.trim();
        return (
          <div>
            <div className="font-medium">{name || 'Sin nombre'}</div>
            <PhoneCell value={row.original.contacts.phone} label="Teléfono" />
          </div>
        );
      },
    },
    {
      id: 'badges',
      header: 'Origen',
      cell: ({ row }) => (
        <div className="flex max-w-xs flex-wrap gap-1">
          {row.original.badges.map((badge) => (
            <Badge
              key={badge}
              variant={badge === 'ONE' || badge === 'WA' ? 'default' : 'secondary'}
              className="text-[10px]"
            >
              {badge}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: 'stage',
      header: 'Etapa',
      cell: ({ row }) => (
        <div>
          <div className="text-sm">{row.original.stage_slug}</div>
          <div className="text-[10px] text-muted-foreground">
            escribe: {row.original.commercial_authority.toUpperCase()}
          </div>
        </div>
      ),
    },
    {
      id: 'advisor',
      header: 'Asesor',
      cell: ({ row }) => row.original.assigned_user_label || '—',
    },
    {
      id: 'interest',
      header: 'Interés',
      cell: ({ row }) => row.original.interest_course || '—',
    },
    {
      id: 'payment',
      header: 'Pago',
      cell: ({ row }) => row.original.payment_link
        ? <Badge variant="outline">{row.original.payment_link}</Badge>
        : '—',
    },
    {
      id: 'call',
      header: 'Última llamada',
      cell: ({ row }) => row.original.last_call_at
        ? (
          <div className="text-xs">
            <div>{formatWhen(row.original.last_call_at)}</div>
            <div className="text-muted-foreground">{row.original.last_call_result}</div>
          </div>
        )
        : '—',
    },
  ], []);

  async function saveStage() {
    if (!expandedId || expandedId.startsWith('wa-cycle-')) {
      toast.error('Etapa WA: cambiala en mali-whatsapp (UX estable para el asesor)');
      return;
    }
    if (ficha?.commercial_authority === 'wa') {
      toast.error('Esta fila escribe en WA; no dual-write desde ONE');
      return;
    }
    setSaving(true);
    try {
      await api.patchCrmEducationOpportunity(expandedId, {
        stage_slug: stageDraft || undefined,
        advisor_email: advisorDraft.trim() || null,
        interest_course: interestDraft.trim() || null,
      });
      toast.success('Etapa actualizada en ONE');
      await load(page);
      const refreshed = await api.getCrmEducationBandejaFicha(expandedId);
      setFicha(refreshed);
      const opp = refreshed.opportunity as { interest_course?: string | null } | null;
      setInterestDraft(opp?.interest_course ?? interestDraft);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Bandeja comercial unificada (ONE + ciclos WA no enlazados). Un escritor de etapa por fila.
        Prospectia status de chat = solo lectura. Asesor en mali-whatsapp no debe notar relocate del dato.
      </p>
      {slaLine ? (
        <p className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          {slaLine}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Buscar</Label>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre o teléfono"
            className="w-56"
          />
        </div>
        <div className="space-y-1">
          <Label>Vista</Label>
          <Select value={view} onValueChange={setView}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Abiertas</SelectItem>
              <SelectItem value="closed">Cerradas</SelectItem>
              <SelectItem value="unassigned">Sin asignar</SelectItem>
              <SelectItem value="solo_contacto">Solo contacto</SelectItem>
              <SelectItem value="all">Todas ONE</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" onClick={() => void load(1)}>Buscar</Button>
        <Button type="button" variant="outline" onClick={() => void load(page)}>Actualizar</Button>
      </div>

      {loading ? <TableShellSkeleton rows={8} cols={7} density="compact" /> : rows.length === 0
        ? <EmptyState title="Sin oportunidades" description="No hay filas para estos filtros." />
        : (
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(row) => row.id}
            onRowClick={(row) => setExpandedId((current) => current === row.id ? null : row.id)}
            isRowExpanded={(row) => expandedId === row.id}
            renderExpandedRow={() => (
              <div className="space-y-3 border-t border-border bg-muted/10 px-4 py-3 text-sm">
                {fichaLoading || !ficha ? (
                  <p className="text-muted-foreground">Cargando ficha…</p>
                ) : !ficha.found ? (
                  <p className="text-muted-foreground">No encontrada</p>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Autoridad</div>
                        <div className="font-medium uppercase">{ficha.commercial_authority}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Ciclo WA / chat</div>
                        <div className="font-mono text-xs">{ficha.wa_cycle_id ?? '—'}</div>
                        {ficha.deep_links?.wa_chat_hint ? (
                          <div className="mt-0.5 text-[10px] text-muted-foreground">{ficha.deep_links.wa_chat_hint}</div>
                        ) : null}
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Prospectia (solo lectura)</div>
                        <div className="text-xs">
                          {(ficha.opportunity as { prospectia_status?: string | null } | null)?.prospectia_status
                            || ficha.deep_links?.prospectia
                            || '—'}
                        </div>
                        {ficha.deep_links?.prospectia_hint ? (
                          <div className="mt-0.5 text-[10px] text-muted-foreground">{ficha.deep_links.prospectia_hint}</div>
                        ) : null}
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Venta / pago</div>
                        <div className="text-xs">{ficha.sale ? 'Hay EducacionSale' : 'Sin venta asociada'}</div>
                      </div>
                    </div>

                    {ficha.commercial_authority === 'one' && ficha.origin === 'one' ? (
                      <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
                        <div className="space-y-1">
                          <Label>Etapa comercial (ONE)</Label>
                          <Select value={stageDraft || 'por_contactar'} onValueChange={setStageDraft}>
                            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STAGE_OPTIONS.map((slug) => (
                                <SelectItem key={slug} value={slug}>{slug}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Asesor (email)</Label>
                          <Input
                            value={advisorDraft}
                            onChange={(e) => setAdvisorDraft(e.target.value)}
                            className="w-56"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Curso / interés</Label>
                          <Input
                            value={interestDraft}
                            onChange={(e) => setInterestDraft(e.target.value)}
                            className="w-56"
                            placeholder="Datos venta"
                          />
                        </div>
                        <Button type="button" size="sm" disabled={saving} onClick={() => void saveStage()}>
                          Guardar etapa
                        </Button>
                        {ficha.wa_cycle_id && onAssociatePayment ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onAssociatePayment(ficha.wa_cycle_id!)}
                          >
                            Asociar pago
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Etapa/assign: usar mali-whatsapp (facade UX estable). ONE solo lee.
                        {ficha.wa_cycle_id && onAssociatePayment ? (
                          <>
                            {' '}
                            <Button
                              type="button"
                              size="sm"
                              variant="link"
                              className="h-auto p-0"
                              onClick={() => onAssociatePayment(ficha.wa_cycle_id!)}
                            >
                              Asociar pago
                            </Button>
                          </>
                        ) : null}
                      </p>
                    )}

                    {(ficha.venta_ready || stageDraft === 'venta_exitosa') ? (
                      <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs">
                        <div className="font-medium">Flujo Venta</div>
                        <p className="mt-1 text-muted-foreground">
                          `venta_exitosa` → datos/cursos → comprobante → asociar Treasury → flag pago.
                          Post-venta (Caja valida CRM↔Treasury + boleteo) en lateral Pagos / Caja.
                        </p>
                        {ficha.wa_cycle_id && onAssociatePayment ? (
                          <Button
                            type="button"
                            size="sm"
                            className="mt-2"
                            onClick={() => onAssociatePayment(ficha.wa_cycle_id!)}
                          >
                            Ir a asociar pago (Treasury)
                          </Button>
                        ) : (
                          <p className="mt-1 text-muted-foreground">
                            Sin ciclo WA enlazado aún: asociá pago cuando exista binding o desde Pagos / Caja.
                          </p>
                        )}
                      </div>
                    ) : null}

                    {ficha.note ? <p className="text-xs text-muted-foreground">{ficha.note}</p> : null}

                    <div>
                      <div className="mb-1 text-xs font-medium text-muted-foreground">Timeline (Anura y actividades)</div>
                      {(ficha.timeline?.length ?? 0) === 0 ? (
                        <p className="text-xs text-muted-foreground">Sin toques registrados en ONE.</p>
                      ) : (
                        <ul className="space-y-2">
                          {ficha.timeline?.map((item) => (
                            <li key={item.id} className="rounded border border-border px-3 py-2 text-xs">
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline">{item.external_system || item.channel}</Badge>
                                <span>{item.direction}</span>
                                <span>{item.result}</span>
                                <span className="text-muted-foreground">{formatWhen(item.occurred_at)}</span>
                              </div>
                              {item.notes ? <p className="mt-1 text-muted-foreground">{item.notes}</p> : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            footer={(pages > 1 || total > PAGE_SIZE) ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  Página {page} de {pages} · {total} filas
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => { const next = page - 1; setPage(next); void load(next); }}
                  >
                    <ChevronLeft className="size-4" /> Anterior
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={page >= pages}
                    onClick={() => { const next = page + 1; setPage(next); void load(next); }}
                  >
                    Siguiente <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            ) : undefined}
          />
        )}
    </div>
  );
}
