-- Rename the stored newsletter kind. Existing rows keep their meaning.
ALTER TYPE "NewsletterKind" RENAME VALUE 'library' TO 'catalog';
