# Landings de MALI Educación

El módulo **Landings** mantiene el contenido, genera la vista previa y congela
una versión HTML al publicar. WordPress conserva la URL pública, pero no guarda
el contenido ni carga su theme.

## Flujo

1. En MALI ONE, un usuario con acceso a `landings` crea o edita bloques.
2. **Guardar borrador** no modifica la versión pública.
3. **Guardar y publicar** genera un nuevo snapshot HTML y aumenta su versión.
4. El plugin `mali-one-embed` resuelve `/landing/{slug}/`, consulta el snapshot
   público y lo entrega como documento completo.
5. El plugin conserva un minuto de caché y un respaldo de siete días para
   errores temporales de MALI ONE. Un `404` elimina el respaldo, de modo que una
   landing despublicada deja de servirse al vencer la caché corta.

La plantilla inicial `gestion-cultural` incorpora el contenido académico aprobado
del HTML `mali_gestion_cultural_landing_v7_sin_banner.html`: 13 módulos, Proyecto
Integrador Final, perfil del participante y ocho docentes. Las fotos se referencian
desde WordPress (`docente_1.jpg` a `docente_8.jpg`, en ese orden); no se incluyen
archivos de imagen en el repositorio. Los ocho docentes parten con el enlace
`https://www.linkedin.com/`, reemplazable por la URL de cada perfil; vaciarlo oculta
su botón. El logo inicial usa `https://educacion.mali.pe/wp-content/uploads/2025/02/logo.png`
y el hero referencia el video externo
`https://educacion.mali.pe/wp-content/uploads/2026/10/Adobe-Express-Testimonios_PEGC_25mb.mp4`.
Los docentes se presentan en un carrusel de tarjetas verticales, con un marco de
foto uniforme 3:4 y biografía debajo. La imagen cubre ese marco sin deformarse,
con el encuadre centrado arriba. Incluye flechas, contador, navegación con teclado
y desplazamiento táctil, con las flechas a ambos lados de las tarjetas. Avanza
cada tres segundos mientras está visible y vuelve al inicio al llegar al final.
El cursor encima y los clics de navegación no detienen el avance. Se pausa al
leer las tarjetas con el foco del teclado o durante un gesto táctil; también
ofrece pausa manual. El movimiento reducido desactiva el avance
automático. Las barras del carrusel y del panel del formulario se ocultan sin
deshabilitar su desplazamiento.
Los controles de reproducción del carrusel y del video usan iconos de reproducir,
pausar, sonido y silencio. Cada botón conserva una etiqueta accesible y un título
descriptivo que cambian junto con el icono según el estado. Mientras el video está
silenciado, su botón muestra también «Activar sonido»; al activar el audio queda solo el icono.
Cada docente tiene un punto de navegación seleccionable. El punto y la tarjeta
activos se resaltan al avanzar automáticamente, usar las flechas o deslizar.
Los puntos y el icono de pausa/reproducción comparten una sola fila centrada.
No se muestran contadores numéricos sobre las fotos ni debajo del carrusel;
el rango visible se anuncia únicamente a lectores de pantalla.
Los enlaces de perfil incluyen el icono de LinkedIn y su etiqueta; ambos aparecen
solo cuando el docente tiene una URL válida, y abren en una pestaña nueva.

La plantilla incorpora iconos SVG de trazo común en los datos del hero, beneficios,
modalidades y acciones; no descarga imágenes ni añade dependencias de iconos.
Los beneficios reemplazan los números decorativos por iconos según su título.
Los acordeones mantienen la apertura exclusiva, muestran una flecha que gira y
resaltan el bloque abierto. Los botones incluyen estados de foco, hover y pulsación.
Encabezados, tarjetas y llamadas a la acción aparecen con un fundido y un recorrido
vertical de 12 px durante 320 ms, una sola vez al entrar en pantalla. Se respeta
el movimiento reducido y el contenido permanece visible sin JavaScript.

Los bloques de texto admiten fotografía externa, texto alternativo, leyenda y
composición a izquierda/derecha o solo texto, editables desde MALI ONE. En el primer
bloque, sin URL propia se reutiliza la primera fotografía de una galería visible;
la opción Solo texto desactiva esta composición. En móvil se muestra texto seguido
de fotografía. Los datos del hero se agrupan en una ficha de consulta rápida.
Las tarjetas de docentes alinean nombres, especialidad y acciones. Las biografías
de más de cuatro líneas ofrecen Leer más/Leer menos sin perder contenido; al
expandirlas se pausa el avance para permitir su lectura. Sin JavaScript se muestra
la biografía completa. La navbar subraya la sección activa según el orden real de
la página e incorpora una barra de progreso que se actualiza al desplazar o cambiar
el tamaño del contenido.

La matrícula inicial confirmada es S/ 490. Las diez cuotas de S/ 630 se conservan
como referencia del HTML y deben revisarse antes de publicar. Matrícula, moneda,
cantidad e importe de cuotas y condiciones se editan en el bloque `investment`.
Cuando inversión y el CTA de WhatsApp están consecutivos, se muestran en dos
columnas de igual altura; en móvil se apilan conservando el orden.
La matrícula se presenta en tamaño destacado (48–64 px). El bloque de inversión
no incluye el antiguo botón Consultar beneficios.
No se incorporan el popup promocional ni los testimonios de ejemplo del HTML.
El bloque `lead_form` reutiliza el widget oficial de Educación y
su flujo MALI ONE → MALI WhatsApp; no envía datos a otros CRM.

El editor mantiene bloques controlados y reordenables. Además de hero, texto,
beneficios, horarios, CTA, preguntas, formulario y footer, incluye `faculty`
para una plana docente con datos opcionales y `gallery` para una selección
editorial de imágenes, `curriculum` e `investment`. Los elementos de listas tienen
campos individuales para conservar espacios y saltos de línea. El máximo es de
50 bloques por landing y 50 elementos por lista; superar el límite devuelve un
error y no descarta contenido silenciosamente.

El hero tiene fondo sólido inicial `#003C7C`, editable desde su bloque mediante
campo hexadecimal o selector de color. El tono anterior `#0022CC` se puede volver
a aplicar en cualquier momento. Las landings guardadas conservan el color que
tengan configurado; cambiar el valor inicial no sustituye sus ediciones.
El hero admite una URL opcional de video. Sin URL no se
crea un reproductor. En escritorio, el video ocupa el tercio derecho del hero,
con un fundido hacia los otros dos tercios de color sólido; el título y los datos
se limitan al área sólida. En móvil (hasta 760 px), el video cubre todo el hero
con una capa del color configurado al 60 %, reforzada al 72 % en la parte superior
para facilitar la lectura del título.
En escritorio, los controles de sonido y reproducción se alinean con la base de
la ficha de datos; en móvil se sitúan en la esquina superior derecha del video,
con espacio reservado antes del texto para evitar superposiciones.
Primero intenta reproducirse silenciado y, una vez iniciado, intenta activar el
audio. Si se rechaza ese intento o el navegador pausa el video al activar el
sonido, vuelve a silenciarlo y reanuda la reproducción. La pausa y la elección de
sonido manuales cancelan el intento automático pendiente. Incluye botones para activar o silenciar
el sonido y pausar o reproducir. El archivo debe incluir audio. Con movimiento reducido no se reproduce
automáticamente, pero los controles permiten iniciarlo de forma manual.
El tamaño del logo y los enlaces de navegación por sección son editables.
Las secciones ocultas no aparecen en la navbar.
Los bloques de contenido alternan fondos blanco y lavanda, derivados del color
principal, según su orden visible. Reordenar u ocultar bloques recalcula esta
alternancia; hero, docentes y llamadas a la acción conservan sus fondos propios.
La tipografía usa una escala común: títulos de sección de 32 px (28 px en móvil),
subtítulos de 20 px, cuerpo de 16 px y etiquetas/notas de 14 px. Solo el título
principal del hero tiene una escala mayor adaptable. Los párrafos excluyen las
etiquetas para evitar que el antetítulo de una sección cambie de tamaño. El
formulario compacto aplica la misma escala sin alterar los embeds tradicionales.

El modo `sticky` del formulario reserva una columna después del hero hasta antes
del footer. En pantallas de hasta 1100 px se usa un botón desplegable después del
hero; cerrar y abrir conserva los datos. El modo `inline` mantiene la sección
tradicional. Solo se monta una instancia del widget en ambos casos. Los cambios
de presentación del widget se activan con `compact=1` y no afectan los embeds
habituales de WordPress. Las dos presentaciones de la landing usan `compact=1`
para conservar la misma tipografía, contraste y estilo de campos.
El formulario compacto usa un fondo lavanda suave, campos redondeados y estados
de foco. El antiguo tono `#b4b3ff` se actualiza visualmente a `#f8f6fb` en este modo;
los colores personalizados se conservan. Los embeds sin `compact=1` mantienen su
presentación habitual.

La vista previa omite GTM y eventos comerciales y transmite `preview=1` al widget.
El botón de envío muestra un mensaje de prueba sin enviar datos ni abrir WhatsApp.
La publicación mantiene el flujo real de captura y atribución.

El mismo widget distingue el origen `landing` de `wordpress_widget`. En ambos
casos conserva durante la sesión y envía `utm_source`, `utm_medium`,
`utm_campaign`, `utm_content`, `utm_term`, `gclid`, `fbclid`, la URL pública y
el referrer. MALI ONE guarda estos datos en `EducacionLead` y los incluye en el
payload del origen que crea en MALI WhatsApp. El mensaje prellenado de WhatsApp
no expone estos datos de atribución.

## Configuración

API de MALI ONE:

```env
APP_URL=https://dev.mali.pe
LANDINGS_PUBLIC_BASE_URL=https://educacion.mali.pe/landing
LANDINGS_GTM_ID=GTM-XXXXXXX
CORS_ORIGINS=https://educacion.mali.pe
```

`LANDINGS_GTM_ID` es opcional. Si se configura, el HTML independiente carga ese
contenedor y emite `view_program`, `click_cta`, `open_form`, `click_whatsapp`,
`download_brochure` y `generate_lead` en `dataLayer`.

WordPress (`wp-config.php`):

```php
define('MALI_ONE_URL', 'https://dev.mali.pe');
```

## Primer despliegue

```bash
pnpm --filter @mali-one/api prisma:migrate
pnpm --filter @mali-one/api prisma:seed:landings
```

Después se actualiza/activa `mali-one-embed`. La versión `1.1.4` refresca las
reglas de rewrite una vez desde `admin_init`; también pueden guardarse de nuevo
los enlaces permanentes de WordPress si la ruta todavía no responde.

El plugin aísla visualmente estas páginas de los elementos globales de GSpeech
(`.gspeech_pro_main_wrapper` y `#sexy_tooltip_title`). GSpeech continúa activo
en las fichas de cursos y en el resto del sitio WordPress.

El seed crea `gestion-cultural` como borrador. Si ya existe, añade los bloques
faltantes de perfil, malla, docentes, galería e inversión y completa las opciones
nuevas cuando aún no existen. Actualiza el antiguo logo predeterminado, completa
el video del hero y los enlaces de LinkedIn vacíos con los valores iniciales.
Conserva URLs personalizadas. Solo sustituye la lista antigua de docentes si no
tiene nombres, cargos, biografías ni LinkedIn editados. Conserva los demás textos,
tarifas y perfiles. Nunca publica. La misma mejora se puede incorporar desde el
botón **Incorporar mejoras de Gestión Cultural** del editor; luego hay que revisar
y guardar o publicar explícitamente. Ejecutar el seed nuevamente es idempotente.

## Verificación local

El pie de página presenta MALI EDUCACIÓN, Museo de Arte de Lima, los enlaces a
Cursos y Talleres, Extensión Profesional, Experiencias Educativas, Arte Empresa
y Nosotros, y los iconos de Instagram, TikTok, Facebook y LinkedIn. Todo se edita
en el bloque Pie de página; vaciar una URL social oculta su icono. Los bloques
antiguos sin estos campos usan el mismo pie institucional, conservando cualquier
texto adicional personalizado. Las redes abren en otra pestaña con `noopener`.

```bash
node --test scripts/landings.test.cjs
pnpm --filter @mali-one/web build
node scripts/validate-landings-ui.cjs
```

La prueba de interfaz requiere Playwright y Edge. Puede configurarse la ruta de
Playwright con `LANDINGS_PLAYWRIGHT_PATH` y la carpeta de capturas con
`LANDINGS_QA_DIR`. Usa una API simulada local, sustituye imágenes externas y no
envía datos a servicios reales. Cubre navbar, malla, límites del formulario sticky,
desplegable móvil, vista previa y edición/guardado/reapertura de matrícula y bio.
