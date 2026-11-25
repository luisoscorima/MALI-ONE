import { Prisma } from '@prisma/client';

/**
 * Single sendability rule for MALICHIMP campaigns:
 * subscribed + no MalichimpSuppression + no EmailGlobalSuppression.
 * Expects the contact row alias to be `contact`.
 * Reused by listTags, resolve-emails, preview, and create/send.
 */
export const MALICHIMP_ELIGIBLE_CONTACT_SQL = Prisma.sql`
  contact."status" = 'subscribed'::"MalichimpContactStatus"
  AND NOT EXISTS (
    SELECT 1 FROM "MalichimpSuppression" suppression
    WHERE suppression."email" = contact."email"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "EmailGlobalSuppression" suppression
    WHERE suppression."email" = contact."email"
  )
`;
