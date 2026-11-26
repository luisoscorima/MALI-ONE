ALTER TABLE "EducacionCatalogSede" ADD COLUMN "whatsapp" TEXT, ADD COLUMN "correo" TEXT;

UPDATE "EducacionCatalogSede" AS sede
SET "whatsapp" = datos.whatsapp, "correo" = datos.correo
FROM (VALUES
    ('innova-schools-bertello',         '923 909 130', 'bertello@mali.pe'),
    ('bellavista',                      '907 982 747', 'callao.bellavista@mali.pe'),
    ('innova-schools-lemos',            '924 478 571', 'callao.lemos@mali.pe'),
    ('innova-schools-santa-rosa',       '924 752 678', 'callao.santarosa@mali.pe'),
    ('innova-schools-carabayllo',       '905 432 885', 'carabayllo@mali.pe'),
    ('innova-schools-el-retablo',       '902 064 970', 'comas.elretablo@mali.pe'),
    ('innova-schools-santa-ana',        '905 432 257', 'losolivos.santaana@mali.pe'),
    ('los-olivos',                      '981 137 746', 'losolivos.villasol@mali.pe'),
    ('innova-schools-mayorazgo',        '977 337 940', 'ate.mayorazgo@mali.pe'),
    ('innova-schools-sanchez-pinillos', '981 296 930', 'cercado@mali.pe'),
    ('la-molina',                       '922 171 667', 'camacho@mali.pe'),
    ('pueblo-libre',                    '905 432 362', 'pueblolibre@mali.pe'),
    ('san-miguel',                      '905 432 279', 'sanmiguel@mali.pe'),
    ('sjl',                             '905 432 923', 'sjl.arabiscos@mali.pe'),
    ('innova-schools-campoy',           '937 008 339', 'sjl.campoy@mali.pe'),
    ('innova-schools-el-sol',           '924 205 793', 'sjl.elsol@mali.pe'),
    ('chorrillos',                      '905 433 170', 'chorrillos.horizontes@mali.pe'),
    ('innova-schools-universo',         '905 432 803', 'chorrillos.universo@mali.pe'),
    ('euroidiomas-miraflores',          '970 870 283', 'miraflores@mali.pe'),
    ('innova-schools-sjm',              '936 904 892', 'sjm@mali.pe'),
    ('innova-schools-peru',             '926 913 277', 'smp.peru@mali.pe'),
    ('innova-schools-surco',            '936 703 903', 'surco@mali.pe'),
    ('innova-schools-ves',              '905 432 950', 'ves@mali.pe')
) AS datos(slug, whatsapp, correo)
WHERE sede."slug" = datos.slug;
