# Estados de lead — Educación

El asesor elige **una** etapa. Cada paso del camino significa más cerca de la inscripción. Al lado, el sistema podrá marcar si la llegada cuenta como captación nueva; esa marca no se elige a mano.

Catálogo en WhatsApp (`lead_status_definitions`), por número: `educacion`, `educacion_ca`, `educacion_ep`. El selector está en **CRM Educación** de MALI ONE (Contactos y Leads), agrupado en Inscripción e Intento o cierre.

Definición: `EDUCATION_LEAD_STATUSES` en mali-whatsapp (`api/src/leads/leads.types.ts`). PAM, TI y Patronato no usan este catálogo.

## Camino de inscripción

| Orden | Estado | Slug | Qué significa |
|------:|--------|------|----------------|
| 1 | Por contactar | `por_contactar` | Llegó y nadie ha hecho el primer intento. Es el estado inicial. |
| 2 | Contactado | `contactado` | El asesor ya escribió o llamó. |
| 3 | Evaluando | `evaluando` | La persona respondió y está mirando curso, horario o precio. |
| 4 | Promesa | `promesa` | Hay una fecha concreta de pago o inscripción. |
| 5 | Venta exitosa | `venta_exitosa` | Se inscribió. El ciclo se cierra. |

## Intento o cierre

Desde Contactado el ciclo puede desviarse. Eso no adelanta la inscripción.

| Estado | Slug | Ciclo | Qué significa |
|--------|------|-------|----------------|
| No contesta | `no_contesta` | Sigue abierto | Hubo intento y no hubo respuesta. Se reintenta. Si responde, pasa a Evaluando. Si se agotan los intentos, cierra en Perdido. |
| No interesado | `no_interesado` | Cierra | Dijo que no. |
| Perdido | `perdido` | Cierra | Se cierra sin venta. Lleva un motivo: no contestó más, promesa vencida, dejó de responder o dato inválido. |

Promesa exige fecha. Si esa fecha pasa, el ciclo cierra en Perdido con motivo «promesa vencida».

## Marcas del sistema

El asesor no las elige. Van junto a cualquier etapa.

| Marca | Cuándo |
|-------|--------|
| Nuevo | La captación abre ciclo: otro curso, o el mismo curso ya fuera de la ventana. |
| Duplicado | Mismo número y mismo curso, dentro de la ventana. No abre otro ciclo. |
| Retorno | Reaparece alguien que estaba en No interesado. Ese contacto se excluye de un masivo de la misma promo. |
| Prometió antes | Vuelve después de una promesa vencida. El ciclo nuevo arranca en Por contactar. |

La ventana de trabajo es de **60 días** desde el último mensaje del cliente. Una venta recién cerrada no abre otro ciclo sola: queda en revisión. Pasada la ventana, sí abre ciclo nuevo.

## Catálogo anterior

Los leads ya etiquetados se movieron así. Las etiquetas viejas quedan inactivas y no salen en el selector.

| Antes | Ahora |
|-------|--------|
| Nuevo | Por contactar |
| Contactado | Contactado |
| Calificado | Evaluando |
| Convertido | Venta exitosa |
| Perdido | Perdido |

Migración: `20260928120000_education_lead_statuses` en mali-whatsapp. Al abrir CRM Educación el API también deja el catálogo al día.

## Qué ya hace el sistema

- Las ocho etiquetas existen en los tres números de Educación y se asignan desde CRM Educación.
- Por contactar es el estado por defecto de un contacto nuevo.
- No contesta no cierra el ciclo. No interesado, Perdido y Venta exitosa sí (`is_terminal`).

Todavía no están solas la fecha de Promesa, el motivo de Perdido, ni las marcas Nuevo, Duplicado, Retorno y Prometió antes. Mientras tanto, un reingreso se clasifica con la regla de 60 días que ya corre en WhatsApp: Venta exitosa va a revisión; No interesado dentro de la ventana también; el resto, dentro de la ventana, sigue en el mismo ciclo.
