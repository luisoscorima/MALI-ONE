import { randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  Prisma,
  type MalichimpContactStatus,
  type PrismaClient,
} from '@prisma/client';
import {
  IMPORT_FILES,
  MAILCHIMP_GROUP_FIELDS,
  fingerprintFiles,
  isBasicEmail,
  mapMailchimpRecord,
  normalizeTagName,
  readCsvRecords,
  type MalichimpRow,
} from './malichimp-import';

export type MalichimpLocatedFile = {
  filePath: string;
  status: MalichimpContactStatus;
};

export type MalichimpImportReport = {
  counts: Record<string, number>;
  totalUnique: number;
  eligibleContacts: number;
  retainedContacts: number;
  suppressions: number;
  tags: number;
  groups: number;
  groupOptions: number;
  errors: string[];
  fingerprint: string;
};

export async function locateMalichimpFiles(
  directory: string,
): Promise<MalichimpLocatedFile[]> {
  const names = await readdir(directory);
  return IMPORT_FILES.map(({ prefix, status }) => {
    const matches = names.filter(
      (name) => name.startsWith(prefix) && name.endsWith('.csv'),
    );
    if (matches.length !== 1) {
      throw new Error(
        `El ZIP debe contener exactamente un archivo ${prefix}*.csv; encontrados: ${matches.length}`,
      );
    }
    return { filePath: path.join(directory, matches[0]), status };
  });
}

export async function inspectMalichimpFiles(
  files: MalichimpLocatedFile[],
): Promise<MalichimpImportReport> {
  const emails = new Map<string, MalichimpContactStatus>();
  const tags = new Set<string>();
  const groups = new Set<string>();
  const groupOptions = new Set<string>();
  const counts: Record<string, number> = {};
  const errors: string[] = [];

  for (const file of files) {
    const records = await readCsvRecords(file.filePath);
    counts[file.status] = records.length;
    for (const record of records) {
      const row = mapMailchimpRecord(record, file.status);
      if (!isBasicEmail(row.email)) {
        errors.push(`${path.basename(file.filePath)} contiene un email inválido`);
        continue;
      }
      const existing = emails.get(row.email);
      if (existing) {
        errors.push(`Email duplicado entre estados: ${existing} / ${file.status}`);
      } else {
        emails.set(row.email, file.status);
      }
      row.tags.forEach((tag) => tags.add(tag.normalizedName));
      row.groups.forEach((membership) => {
        groups.add(membership.groupNormalizedName);
        groupOptions.add(
          `${membership.groupNormalizedName}\u0000${membership.optionNormalizedName}`,
        );
      });
    }
  }

  return {
    counts,
    totalUnique: emails.size,
    eligibleContacts: counts.subscribed ?? 0,
    retainedContacts:
      (counts.subscribed ?? 0) +
      (counts.unsubscribed ?? 0) +
      (counts.nonsubscribed ?? 0),
    suppressions: (counts.unsubscribed ?? 0) + (counts.cleaned ?? 0),
    tags: tags.size,
    groups: groups.size,
    groupOptions: groupOptions.size,
    errors,
    fingerprint: await fingerprintFiles(files.map((file) => file.filePath)),
  };
}

function contactValues(row: MalichimpRow) {
  return Prisma.sql`(
    ${randomUUID()}, ${row.email}, ${row.firstName}, ${row.lastName}, ${row.phone},
    ${row.institutionName}, ${row.jobTitle}, ${row.city}, ${row.country},
    ${row.classification}, ${row.source}, ${row.status}::"MalichimpContactStatus",
    ${row.optInAt}, ${row.confirmedAt}, ${row.statusChangedAt},
    ${row.attributes ? JSON.stringify(row.attributes) : null}::jsonb,
    NOW(), NOW()
  )`;
}

async function importBatch(tx: Prisma.TransactionClient, rows: MalichimpRow[]) {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "MalichimpContact" (
        "id", "email", "firstName", "lastName", "phone", "institutionName",
        "jobTitle", "city", "country", "classification", "source", "status",
        "optInAt", "confirmedAt", "statusChangedAt", "attributes", "createdAt", "updatedAt"
      ) VALUES ${Prisma.join(rows.map(contactValues))}
      ON CONFLICT ("email") DO UPDATE SET
        "firstName" = EXCLUDED."firstName",
        "lastName" = EXCLUDED."lastName",
        "phone" = EXCLUDED."phone",
        "institutionName" = EXCLUDED."institutionName",
        "jobTitle" = EXCLUDED."jobTitle",
        "city" = EXCLUDED."city",
        "country" = EXCLUDED."country",
        "classification" = EXCLUDED."classification",
        "source" = EXCLUDED."source",
        "status" = EXCLUDED."status",
        "optInAt" = EXCLUDED."optInAt",
        "confirmedAt" = EXCLUDED."confirmedAt",
        "statusChangedAt" = EXCLUDED."statusChangedAt",
        "attributes" = EXCLUDED."attributes",
        "updatedAt" = NOW()
    `);

    const contacts = await tx.malichimpContact.findMany({
      where: { email: { in: rows.map((row) => row.email) } },
      select: { id: true, email: true },
    });
    const contactIds = contacts.map((contact) => contact.id);
    const contactIdByEmail = new Map(
      contacts.map((contact) => [contact.email, contact.id]),
    );
    if (contactIds.length) {
      await Promise.all([
        tx.malichimpContactTag.deleteMany({
          where: { contactId: { in: contactIds } },
        }),
        tx.malichimpContactGroupOption.deleteMany({
          where: { contactId: { in: contactIds } },
        }),
      ]);
    }

    const uniqueTags = new Map<string, string>();
    rows.forEach((row) =>
      row.tags.forEach((tag) => uniqueTags.set(tag.normalizedName, tag.name)),
    );
    if (uniqueTags.size) {
      await tx.malichimpTag.createMany({
        data: [...uniqueTags].map(([normalizedName, name]) => ({
          id: randomUUID(),
          name,
          normalizedName,
        })),
        skipDuplicates: true,
      });
      const tags = await tx.malichimpTag.findMany({
        where: { normalizedName: { in: [...uniqueTags.keys()] } },
        select: { id: true, normalizedName: true },
      });
      const tagIdByName = new Map(
        tags.map((tag) => [tag.normalizedName, tag.id]),
      );
      const links = rows.flatMap((row) => {
        const contactId = contactIdByEmail.get(row.email);
        if (!contactId) return [];
        return row.tags.flatMap((tag) => {
          const tagId = tagIdByName.get(tag.normalizedName);
          return tagId ? [{ contactId, tagId }] : [];
        });
      });
      if (links.length) {
        await tx.malichimpContactTag.createMany({
          data: links,
          skipDuplicates: true,
        });
      }
    }

    const uniqueGroups = new Map<
      string,
      { name: string; sortOrder: number }
    >();
    rows.forEach((row) => row.groups.forEach((membership) => {
      uniqueGroups.set(membership.groupNormalizedName, {
        name: membership.groupName,
        sortOrder: membership.groupSortOrder,
      });
    }));
    if (uniqueGroups.size) {
      await tx.malichimpGroup.createMany({
        data: [...uniqueGroups].map(([normalizedName, group]) => ({
          id: randomUUID(),
          name: group.name,
          normalizedName,
          sortOrder: group.sortOrder,
        })),
        skipDuplicates: true,
      });
      const importedGroups = await tx.malichimpGroup.findMany({
        where: { normalizedName: { in: [...uniqueGroups.keys()] } },
        select: { id: true, normalizedName: true },
      });
      const groupIdByName = new Map(
        importedGroups.map((group) => [group.normalizedName, group.id]),
      );
      const uniqueOptions = new Map<
        string,
        { groupId: string; name: string; normalizedName: string }
      >();
      rows.forEach((row) => row.groups.forEach((membership) => {
        const groupId = groupIdByName.get(membership.groupNormalizedName);
        if (!groupId) return;
        uniqueOptions.set(`${groupId}\u0000${membership.optionNormalizedName}`, {
          groupId,
          name: membership.optionName,
          normalizedName: membership.optionNormalizedName,
        });
      }));
      if (uniqueOptions.size) {
        await tx.malichimpGroupOption.createMany({
          data: [...uniqueOptions.values()].map((option) => ({
            id: randomUUID(),
            ...option,
          })),
          skipDuplicates: true,
        });
        const importedOptions = await tx.malichimpGroupOption.findMany({
          where: { groupId: { in: importedGroups.map((group) => group.id) } },
          select: { id: true, groupId: true, normalizedName: true },
        });
        const optionIdByKey = new Map(
          importedOptions.map((option) => [
            `${option.groupId}\u0000${option.normalizedName}`,
            option.id,
          ]),
        );
        const links = rows.flatMap((row) => {
          const contactId = contactIdByEmail.get(row.email);
          if (!contactId) return [];
          return row.groups.flatMap((membership) => {
            const groupId = groupIdByName.get(membership.groupNormalizedName);
            if (!groupId) return [];
            const optionId = optionIdByKey.get(
              `${groupId}\u0000${membership.optionNormalizedName}`,
            );
            return optionId ? [{ contactId, optionId }] : [];
          });
        });
        if (links.length) {
          await tx.malichimpContactGroupOption.createMany({
            data: links,
            skipDuplicates: true,
          });
        }
      }
    }

    const suppressed = rows.filter((row) => row.suppression);
    if (suppressed.length) {
      const values = suppressed.map((row) => {
        const suppression = row.suppression!;
        return Prisma.sql`(
          ${randomUUID()}, ${row.email},
          ${suppression.reason}::"MalichimpSuppressionReason", 'mailchimp_import',
          ${suppression.occurredAt},
          ${suppression.metadata ? JSON.stringify(suppression.metadata) : null}::jsonb,
          NOW(), NOW()
        )`;
      });
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "MalichimpSuppression" (
          "id", "email", "reason", "source", "occurredAt", "metadata", "createdAt", "updatedAt"
        ) VALUES ${Prisma.join(values)}
        ON CONFLICT ("email") DO UPDATE SET
          "reason" = EXCLUDED."reason",
          "source" = EXCLUDED."source",
          "occurredAt" = EXCLUDED."occurredAt",
          "metadata" = EXCLUDED."metadata",
          "updatedAt" = NOW()
        WHERE "MalichimpSuppression"."source" = 'mailchimp_import'
      `);
    }

    const deliverable = rows
      .filter((row) => !row.suppression)
      .map((row) => row.email);
    if (deliverable.length) {
      await tx.malichimpSuppression.deleteMany({
        where: { email: { in: deliverable }, source: 'mailchimp_import' },
      });
    }
}

export async function applyMalichimpFiles(
  prisma: PrismaClient,
  files: MalichimpLocatedFile[],
  report: MalichimpImportReport,
  options: {
    sourceKey: string;
    sourceDirectory: string;
    batchSize?: number;
    onProgress?: (processed: number, total: number) => void | Promise<void>;
  },
) {
  if (report.errors.length) {
    throw new Error(`Importación cancelada: ${report.errors.length} error(es)`);
  }
  const batchSize = Math.max(100, Math.min(2_000, options.batchSize ?? 1_000));
  const run = await prisma.malichimpImportRun.create({
    data: {
      sourceKey: options.sourceKey.slice(0, 160),
      sourceDirectory: options.sourceDirectory.slice(0, 500),
      fileFingerprint: report.fingerprint,
      counts: report,
    },
  });

  let processed = 0;
  await prisma.$transaction(async (tx) => {
    await tx.malichimpGroup.createMany({
      data: MAILCHIMP_GROUP_FIELDS.map(({ source }, sortOrder) => ({
        id: randomUUID(),
        name: source,
        normalizedName: normalizeTagName(source),
        sortOrder,
      })),
      skipDuplicates: true,
    });
    for (const file of files) {
      const records = await readCsvRecords(file.filePath);
      for (let index = 0; index < records.length; index += batchSize) {
        const rows = records
          .slice(index, index + batchSize)
          .map((record) => mapMailchimpRecord(record, file.status));
        await importBatch(tx, rows);
        processed += rows.length;
        await options.onProgress?.(processed, report.totalUnique);
      }
    }
    await tx.malichimpImportRun.update({
      where: { id: run.id },
      data: { completedAt: new Date() },
    });
  }, { maxWait: 30_000, timeout: 30 * 60 * 1000 });
  return { runId: run.id, imported: processed };
}
