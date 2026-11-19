// Run inside the API container via stdin. Read-only; emits no names/phones/tokens.
const { PrismaClient } = require('@prisma/client');
const { existsSync } = require('node:fs');
const root = existsSync('./dist/src/modules') ? './dist/src/modules' : './dist/modules';
const load = (path, name) => require(`${process.cwd()}/${root}/${path}`)[name];
const p = new PrismaClient();
const Client = load('crm/whatsapp-crm-client.service', 'WhatsappCrmClientService');
const Crm = load('crm-educacion/crm-educacion.service', 'CrmEducacionService');
const Sales = load('crm-educacion/educacion-sale.service', 'EducacionSaleService');
const Opportunities = load('crm-educacion/prospectia/educacion-opportunity.service', 'EducacionOpportunityService');
const Bandeja = load('crm-educacion/educacion-bandeja.service', 'EducacionBandejaService');
const crm = new Crm(new Client({ get: k => process.env[k] }, p), new Sales(p), null);
const bandeja = new Bandeja(p, new Opportunities(p), crm);
const report = { authority: process.env.COMMERCIAL_AUTHORITY || 'wa', sample: [], checks: [] };
(async () => {
  for (const category of ['ca', 'ep']) {
    const cycles = await crm.cycles({ categoria: category, view: 'open', limit: '200' });
    const view = await bandeja.list({ categoria: category, view: 'open', limit: 100 });
    const candidates = (view.items || []).filter(v => v.origin === 'wa')
      .map(row => ({ row, cycle: cycles.items.find(c => c.id === row.wa_cycle_id) }))
      .filter(v => v.cycle)
      .sort((a, b) => Number(b.cycle.lead_status?.slug !== 'por_contactar') - Number(a.cycle.lead_status?.slug !== 'por_contactar'));
    for (const { row, cycle } of candidates.slice(0, 5)) {
      const ficha = await bandeja.getFicha(row.id);
      const stage = cycle.lead_status?.slug || cycle.lead_status_slug || 'por_contactar';
      report.sample.push({ category, cycle: cycle.id, waStage: stage, oneStage: row.stage_slug,
        equal: stage === row.stage_slug, fichaFound: ficha.found, linkedNative: false });
    }
    report.checks.push({ category, waReturned: cycles.items.length, bandejaReturned: view.items.length });
  }
  report.counts = {
    opportunities: await p.educacionOpportunity.count(),
    linked: await p.educacionOpportunity.count({ where: { waCycleId: { not: null } } }),
    events: await p.educacionChannelEvent.count(),
    sales: await p.educacionSale.count(),
    anuraActivities: await p.educacionCrmActivity.count({ where: { externalSystem: 'anura' } }),
  };
  console.log(JSON.stringify(report, null, 2));
  if (report.sample.length < 5 || report.sample.some(r => !r.equal || !r.fichaFound)) process.exitCode = 1;
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => p.$disconnect());
