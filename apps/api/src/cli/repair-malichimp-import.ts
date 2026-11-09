import { Prisma, PrismaClient } from '@prisma/client';
import {
  cleanImportedText,
  normalizeTagName,
} from '../modules/malichimp/lib/malichimp-import';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

const TEXT_FIELDS = {
  firstName: 160,
  lastName: 160,
  phone: 80,
  institutionName: 300,
  jobTitle: 200,
  city: 160,
  country: 120,
  classification: 160,
  source: 240,
} as const;

function repairJson(value: Prisma.JsonValue): Prisma.JsonValue | undefined {
  if (typeof value === 'string') return cleanImportedText(value) ?? undefined;
  if (Array.isArray(value)) {
    return value
      .map((entry) => repairJson(entry))
      .filter((entry): entry is Prisma.JsonValue => entry !== undefined);
  }
  if (value && typeof value === 'object') {
    const result: Prisma.JsonObject = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) continue;
      const repaired = repairJson(entry);
      if (repaired !== undefined) result[key] = repaired;
    }
    return result;
  }
  return value;
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function repairContacts() {
  let cursor: string | undefined;
  let inspected = 0;
  let changed = 0;

  while (true) {
    const contacts = await prisma.malichimpContact.findMany({
      take: 1_000,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        institutionName: true,
        jobTitle: true,
        city: true,
        country: true,
        classification: true,
        source: true,
        attributes: true,
      },
    });
    if (!contacts.length) break;
    cursor = contacts.at(-1)!.id;
    inspected += contacts.length;

    const updates: Array<{
      id: string;
      data: Prisma.MalichimpContactUpdateInput;
    }> = [];
    for (const contact of contacts) {
      const data: Prisma.MalichimpContactUpdateInput = {};
      for (const [field, max] of Object.entries(TEXT_FIELDS) as Array<
        [keyof typeof TEXT_FIELDS, number]
      >) {
        const repaired = cleanImportedText(contact[field], max);
        if (repaired !== contact[field]) data[field] = repaired;
      }
      const repairedAttributes = contact.attributes
        ? repairJson(contact.attributes)
        : undefined;
      if (JSON.stringify(repairedAttributes ?? null) !== JSON.stringify(contact.attributes)) {
        data.attributes = repairedAttributes ?? Prisma.DbNull;
      }
      if (Object.keys(data).length) updates.push({ id: contact.id, data });
    }

    changed += updates.length;
    if (apply) {
      for (const batch of chunks(updates, 100)) {
        await prisma.$transaction(
          batch.map((update) =>
            prisma.malichimpContact.update({
              where: { id: update.id },
              data: update.data,
            }),
          ),
        );
      }
    }
    if (inspected % 10_000 === 0) {
      console.log(`Contactos revisados: ${inspected}; por corregir: ${changed}`);
    }
  }
  return { inspected, changed };
}

async function repairTags() {
  const tags = await prisma.malichimpTag.findMany({ orderBy: { id: 'asc' } });
  const groups = new Map<string, typeof tags>();
  const invalid: typeof tags = [];

  for (const tag of tags) {
    const name = cleanImportedText(tag.name.replace(/^"+|"+$/g, ''), 200);
    if (!name) {
      invalid.push(tag);
      continue;
    }
    const normalizedName = normalizeTagName(name);
    const group = groups.get(normalizedName) ?? [];
    group.push({ ...tag, name, normalizedName });
    groups.set(normalizedName, group);
  }

  const changed = [...groups.values()].reduce(
    (count, group) =>
      count + group.filter((tag) => {
        const original = tags.find((candidate) => candidate.id === tag.id)!;
        return tag.name !== original.name || tag.normalizedName !== original.normalizedName;
      }).length,
    invalid.length,
  );
  const merged = [...groups.values()].reduce(
    (count, group) => count + Math.max(0, group.length - 1),
    0,
  );

  if (!apply) return { inspected: tags.length, changed, merged, deleted: invalid.length };

  if (invalid.length) {
    await prisma.malichimpTag.deleteMany({
      where: { id: { in: invalid.map((tag) => tag.id) } },
    });
  }

  for (const [normalizedName, group] of groups) {
    const keeper =
      group.find((tag) => tag.normalizedName === normalizedName) ?? group[0];
    const duplicates = group.filter((tag) => tag.id !== keeper.id);
    if (duplicates.length) {
      const duplicateIds = duplicates.map((tag) => tag.id);
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "MalichimpContactTag" ("contactId", "tagId", "createdAt")
        SELECT "contactId", ${keeper.id}, "createdAt"
        FROM "MalichimpContactTag"
        WHERE "tagId" IN (${Prisma.join(duplicateIds)})
        ON CONFLICT ("contactId", "tagId") DO NOTHING
      `);
      await prisma.malichimpTag.deleteMany({ where: { id: { in: duplicateIds } } });
    }
    await prisma.malichimpTag.update({
      where: { id: keeper.id },
      data: { name: keeper.name, normalizedName },
    });
  }

  return { inspected: tags.length, changed, merged, deleted: invalid.length };
}

async function main() {
  console.log(apply ? 'Modo: aplicar cambios' : 'Modo: simulación (sin escrituras)');
  const contacts = await repairContacts();
  const tags = await repairTags();
  console.log(JSON.stringify({ contacts, tags }, null, 2));
  if (!apply) {
    console.log('Para aplicar: pnpm --filter @mali-one/api prisma:repair:malichimp -- --apply');
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
