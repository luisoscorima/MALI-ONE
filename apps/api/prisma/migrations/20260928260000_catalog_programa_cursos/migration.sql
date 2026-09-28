CREATE TABLE "EducacionCatalogProgramaCurso" (
    "programaId" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "EducacionCatalogProgramaCurso_pkey" PRIMARY KEY ("programaId", "cursoId")
);

CREATE INDEX "EducacionCatalogProgramaCurso_cursoId_idx" ON "EducacionCatalogProgramaCurso"("cursoId");

ALTER TABLE "EducacionCatalogProgramaCurso"
  ADD CONSTRAINT "EducacionCatalogProgramaCurso_programaId_fkey"
  FOREIGN KEY ("programaId") REFERENCES "EducacionCatalogPrograma"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EducacionCatalogProgramaCurso"
  ADD CONSTRAINT "EducacionCatalogProgramaCurso_cursoId_fkey"
  FOREIGN KEY ("cursoId") REFERENCES "EducacionCatalogCurso"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
