# CRM Educación: modelo operativo de referencia

**Propósito:** explicar el negocio en sencillo — qué hace cada herramienta, qué
piezas existen, cómo interactúan y el recorrido de interés a cliente — antes de
añadir reglas finas, pantallas o integraciones.

**Jerarquía:** esta guía es la **única fuente de verdad de negocio** hasta que
asesor, jefe y Caja la ratifiquen. El [documento del módulo](../crm-educacion.md)
guarda implementación, APIs y transición. Sus anexos de diseño y los [permisos
propuestos](../crm-educacion-roles.md#permisos-propuestos-por-acción) son
propuestas pendientes: no sustituyen ni adelantan esta ruta.

**Estado:** funcionamiento objetivo a ratificar. La regla de lead nuevo proviene
del usuario; X, definición de cliente e intereses simultáneos siguen abiertos.
No describe todo como implementado ni autoriza migraciones por sí solo.

## 1. La historia que el sistema debe poder contar

Una persona expresa interés. Registramos la consulta y reconocemos a la persona.
Abrimos o continuamos un lead. Un asesor lo atiende por los medios que
convengan y registra lo ocurrido. Si hay acuerdo de compra, cerramos el lead
como venta exitosa y creamos la venta. El comprador reporta su pago; Caja lo contrasta
con Treasury y aplica el importe a esa venta. Después se completan matrícula y
boleteo según sus requisitos, conservando cada confirmación por separado.

Si no hay acuerdo, el lead termina sin venta y con motivo. La persona y
el historial permanecen. Una consulta posterior puede iniciar otro lead.

Para simplificar el vocabulario:

- **Persona:** quién es.
- **Lead:** persona + interés comercial que se está atendiendo en esta ocasión.
  Es el término principal del equipo, de esta guía y de la futura interfaz.
- **Ciclo del lead:** recorrido e historial de ese lead desde apertura hasta cierre;
  no un segundo registro comercial independiente.
- **Contacto:** representación de una persona dentro de una herramienta.
- **Cliente — definición propuesta:** persona compradora con al menos una venta
  que recibió un pago validado. Un abono cuenta como relación comercial, pero no
  significa saldo cancelado ni habilitación automática de matrícula. Antes de eso
  puede existir una venta acordada pendiente de pago. No crear otra persona ni
  otra tabla de identidad al convertirla en cliente. El pagador no se vuelve
  automáticamente comprador. Una devolución conserva el historial de relación.

Esta definición de cliente es una recomendación pendiente de ratificación.
Los indicadores deben distinguir leads ganados, clientes con pago validado
y ventas totalmente pagadas.


En el código actual pueden aparecer nombres como `EducacionOpportunity` o rutas
`opportunities`. Representan el **lead** de negocio; no son otra entidad. Esta
corrección de vocabulario no requiere renombrar tablas, endpoints ni datos existentes.

## 2. Qué hace cada herramienta

**Mali WhatsApp:** recibe captaciones de sus fuentes y conserva contactos del canal,
líneas, conversaciones, mensajes y campañas individuales/masivas. Es la superficie
habitual del asesor. Puede mostrar el lead y solicitar cambios comerciales
a ONE sin exigir que el asesor cambie de pantalla.

**Prospectia:** aporta sus captaciones y conversaciones. Mantiene sus contactos,
identificadores y estado local. ONE incorpora referencias y actividad relevante.
Si no se puede escribir en Prospectia, su estado se muestra como externo; no debe
sobrescribir silenciosamente la etapa comercial central.

**Anura:** aporta llamadas entrantes/salientes y resultados. Normalmente registra
actividad de un lead existente. Una llamada abre lead solo cuando
contiene una consulta comercial nueva reconocida por el asesor o una regla explícita.

**MALI ONE:** organiza y administra el negocio mediante módulos internos:

- **Personas:** identidad comercial confirmada y vínculos a contactos externos.
- **CRM Educación:** leads, responsables, actividades, ventas y seguimiento.
- **Catálogo:** qué se ofrece; curso, edición/programación cuando exista y precio de referencia.
- **Treasury:** qué operación financiera existe, con qué importe, moneda y estado.
- **Postventa:** expediente de matrícula y documentos emitidos; inicialmente puede
  registrar referencias de los sistemas externos que hacen esos trámites.

Son responsabilidades lógicas: no requieren nuevos servicios, aplicaciones ni una
pantalla independiente por cada concepto. CRM PAM conserva su proceso de membresías;
puede reutilizar identidad y servicios financieros sin adoptar el embudo educativo.

## 3. Las piezas y sus datos mínimos

Los atributos siguientes describen información de negocio; no son una orden para
crear tablas nuevas. Primero se mapean a los modelos y campos existentes.

**Persona.** ID estable, nombres conocidos, teléfonos/correos, documento cuando sea
necesario y referencias externas. Un teléfono puede ser compartido; una coincidencia
ambigua queda para revisión. Los datos confirmados tienen prioridad sobre nombres
de perfil. Comprador, alumno y pagador son roles de personas en una venta.

**Captación.** ID externo/origen, fecha real, persona o contacto provisional,
interés expresado, fuente/campaña, herramienta receptora y lead asociado.
Conserva por qué llegó alguien. Varias captaciones pueden pertenecer a la misma
lead. Un webhook repetido no es una nueva captación.

**Lead.** ID, persona, interés, categoría, asesor comercial, etapa,
apertura, última interacción efectiva, próxima gestión, cierre/motivo y referencia
al anterior cuando corresponda. Al principio el interés puede ser texto o una
categoría; antes de vender debe concretarse la oferta. El estado y el asesor
pertenecen a este lead, no a toda la persona.

**Actividad.** ID, lead, fecha, canal, dirección, herramienta, actor,
resultado, nota y referencia al mensaje/llamada. Una llamada atendida y una no
contestada son resultados distintos. ONE necesita contexto y referencias, no otra
copia completa de todos los mensajes ni grabaciones.

**Oferta de catálogo.** ID, curso, edición/programación cuando aplique, modalidad,
disponibilidad y precio de referencia. La categoría CA/EP no identifica una compra.
Una venta captura la oferta y el precio acordados para conservar su historia.

**Venta.** ID, lead ganado, comprador, alumno cuando se conozca, ítems,
importe acordado, moneda, condiciones de pago y estado de cancelación si corresponde.
El asesor comercial queda registrado. Una venta puede tener varios ítems del mismo
acuerdo. Cambiar el catálogo o asociar un comprobante no altera esos datos.

**Cobro de Treasury.** Identidad estable de proveedor/operación, comercio/cuenta,
fecha, importe, moneda y estado financiero. Existe independientemente de que se
conozca a qué venta pertenece. El archivo enviado por el comprador es evidencia
reportada, no otra operación financiera ni confirmación suficiente de cobro.

**Aplicación de pago.** Vínculo entre un cobro y una venta, importe aplicado, actor,
fecha y eventual reversión/motivo. Una venta puede tener varios pagos. Si se admite
repartir un cobro, la suma aplicada nunca supera su saldo. No asignar el mismo dinero
dos veces. El saldo de la venta se calcula con aplicaciones vigentes.

Matrícula y documento de venta conservan sus propias referencias, fechas y estados.
Inicialmente basta registrarlos; no necesitan convertirse en sistemas académicos
o de facturación completos dentro del CRM.

## 4. El recorrido y quién responde por cada paso

1. **Recibir interés.** La herramienta entrega la captación. ONE identifica o deja
   provisional a la persona y decide abrir/continuar un lead. La falta de
   asesor no debe impedir conservarla. Se preservan la primera fuente y las posteriores.
2. **Asignar y atender.** El sistema aplica una regla acordada o el jefe asigna.
   Un asesor puede reclamar un lead libre y elegible. Las gestiones por
   WhatsApp, Prospectia, Anura o correo se conectan al mismo recorrido.
3. **Resolver preventa.** El asesor propietario registra acuerdo explícito, oferta,
   importe y condiciones: ONE cierra el lead como venta exitosa y crea una sola venta. Sin acuerdo,
   continúa la gestión o cierra con motivo. Un reintento no duplica la venta.
4. **Reportar pago.** El asesor adjunta evidencia y propone la operación de Treasury
   que corresponde. Se muestra «reportado», sin cambiar precio, propietario ni
   declarar el saldo pagado. Una coincidencia ambigua exige selección/revisión.
5. **Validar y aplicar.** Caja comprueba operación, estado, moneda, importe y saldo.
   El sistema aplica el importe sin duplicarlo. Se refleja pago parcial/total u
   observación. La actualización del proveedor puede exigir una revisión posterior.
6. **Completar postventa.** Caja gestiona el documento; administración académica
   registra matrícula. Se habilitan según los requisitos de pago/datos aprobados.
   Boleteo no implica matrícula y matrícula no confirma por sí sola el cobro.

El jefe resuelve reasignaciones, conflictos y correcciones comerciales. Caja decide
las validaciones financieras. Cubrir un chat no transfiere propiedad ni comisión.
Los permisos se comprueban en servidor; ser administrador técnico no sustituye una
autorización de negocio. Detalle: [roles](../crm-educacion-roles.md#permisos-propuestos-por-acción).

## 5. Reglas que sostienen la ruta sencilla

- Una persona puede tener varios leads a lo largo del tiempo.
- Un lead puede recibir varias captaciones y usar varios canales.
- Según la regla aportada, un lead distinto nace por X tiempo o por nuevo
  interés después de cerrar el anterior, aunque no haya transcurrido X.
- X está pendiente. Se propone medir inactividad efectiva si está abierto y tiempo
  desde cierre si está cerrado. El tiempo solo no crea un lead vacío.
- Soporte, voucher o matrícula de una compra existente pertenecen a postventa,
  aunque el cliente escriba por otro número o haya transcurrido X.
- Un interés distinto mientras el anterior sigue abierto requiere aclarar si es
  alternativa de la misma compra o compra independiente; por ahora, revisión humana.
- La venta ganada expresa acuerdo comercial. Pago validado expresa respaldo
  financiero. Matrícula y boleteo expresan trámites diferentes.
- Destino: un escritor comercial en ONE. La sincronización distribuye hechos o
  refleja decisiones; no permite que cada herramienta decida una etapa diferente.
- Una falla entre aplicaciones deja trabajo pendiente y visible. No se muestra
  confirmación de una acción que el dueño del dato todavía no aceptó.
- Se conservan historia e identificadores; las correcciones se registran, no se
  resuelven borrando leads o moviendo pagos sin rastro.

## 6. Un ejemplo completo

Ana consulta por fotografía desde un anuncio que entra a Prospectia. Se registra
Ana y un lead, con esa captación como origen. El asesor la llama por Anura
y después continúa por Mali WhatsApp. Son actividades del mismo lead.

Ana acepta una oferta concreta por S/500. El lead se cierra como venta exitosa y nace una venta de
S/500 pendiente de pago. Ana envía un comprobante de S/100; el asesor lo reporta.
Caja encuentra la operación correcta en Treasury y aplica S/100. Quedan S/400
pendientes. Según la definición propuesta, Ana ya es cliente con pago validado;
eso no permite afirmar que pagó todo ni que ya está matriculada.

Cuando se cumplen las condiciones aprobadas se registran matrícula y documento,
cada uno con su referencia. Si Ana pregunta por su comprobante, sigue en postventa.
Si quiere comprar otro curso después del cierre, nace otro lead de la misma
persona. La venta anterior y sus pagos no cambian.

## 7. Qué reutilizamos y qué falta ordenar

Reutilizar: captura y mensajería WA, contactos y ciclos actuales, integración
Prospectia, actividades Anura, Catálogo, operaciones Treasury, ventas/aplicaciones,
vínculos y entrega shadow ya construidos. Los nombres técnicos actuales pueden
mantenerse mientras se aclara su correspondencia con este modelo.

Hoy el motor comercial global todavía está en WA y hay leads nativos ONE.
Los vínculos y eventos shadow no garantizan aún un lead único entre todos
los medios. La política vigente de WA mantiene `venta_exitosa` abierta hasta pago
o cierre justificado. Separar cierre comercial de cobranza, como propone esta guía,
necesita implementación y transición explícitas; no cambiar ciclos históricos a ciegas.

Checklist as-is / to-be y gráfico del modelo ideal:
[checklist-ratificacion.md](./checklist-ratificacion.md).
Si el producto debe cambiar de rumbo, se edita **esta** guía; la checklist se
realinea después.

Prioridades siguientes:

1. Ratificar esta guía con asesor, jefe y Caja (usar la checklist) hasta que todos
   describan igual una consulta, un lead, una venta y un pago. Resolver X, cliente,
   intereses simultáneos y condiciones de habilitación en esta misma ruta; no
   enterrarlas en anexos ni en código.
2. Comprobar cinco ejemplos: compra normal, captación repetida por otro medio,
   retorno tras X, nuevo interés tras cierre y pago parcial/con observación.
3. Mapear cada pieza al código actual (reutilizable / por ajustar / ausente).
   Un solo listado de diferencias, sin reconstruir los productos.
4. Consolidar un recorrido completo con una fuente: lead → venta → pago
   reportado → validación → saldo correcto, con reintentos y permisos básicos.
5. Solo entonces: precisiones de anexos, más escenarios, vistas UI y matches
   entre herramientas — siempre explicables sobre esta ruta. Trasladar autoridad
   comercial a ONE con equivalencia y un escritor definido.

Menos es más: no ampliar scoring, comisiones, atribución compleja, automatización
de matrícula ni rediseño del inbox mientras falte esta base. Integridad y
seguridad operativa siguen teniendo prioridad durante la simplificación.
