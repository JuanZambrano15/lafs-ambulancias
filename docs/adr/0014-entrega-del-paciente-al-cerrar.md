# ADR-0014: "Entrega del paciente" se pide al cerrar, no en el encabezado inicial

- **Fecha:** 2026-10-22
- **Estado:** Aceptada

## Contexto

El encabezado del formato de traslado (issue #8, ADR-0006) se llena
todo de una sola vez al recibir al paciente, incluyendo "entrega del
paciente" (fecha, hora, ciudad, IPS, servicio de destino) — pero a esa
hora todavía no se sabe nada de eso, porque el traslado apenas empieza.
Encontrado en la prueba QA del issue #49 (issue #55).

El issue original proponía partir el encabezado en 3 pasos (recepción
al iniciar / estado del paciente durante el traslado / entrega al
cerrar) y sugería revisar si hacía falta cambiar la forma del endpoint
de encabezado (hoy es un solo PUT con todo el formulario junto). El
formato de accidente SOAT (issue #17) ya había resuelto exactamente el
mismo problema con `hora_entrega` (issue #70, QA): se pide al cerrar la
atención, en `ClinicoAccidenteSoatPage`, reenviando el encabezado
completo con ese único campo puesto — sin crear un endpoint nuevo ni
cambiar la forma del existente.

## Decisión

Mismo patrón que SOAT, extendido a los 5 campos de entrega del
traslado (no solo la hora):

- **Backend:** `entrega_fecha`, `entrega_hora`, `entrega_ciudad`,
  `entrega_ips`, `entrega_servicio` pasan a nullable tanto en el modelo
  (`FormatoTraslado`) como en el schema de entrada
  (`FormatoTrasladoEncabezado`). No se crea ningún endpoint nuevo: el
  mismo `PUT /atenciones/{id}/formato-traslado` que ya existía sigue
  sirviendo para guardar la entrega, mandando el encabezado completo
  con esos 5 campos puestos (ADR-0006: siempre se manda el formulario
  completo, nunca un parche parcial).
- `_campos_faltantes_para_cerrar` (issue #57) se extiende para
  exigir los 5 campos de entrega antes de poder cerrar — antes esto lo
  garantizaba Pydantic solo con que el campo fuera obligatorio en el
  encabezado; al volverse opcional ahí, hace falta esta validación
  para que sea realmente obligatorio *al cerrar*, no en cualquier
  momento.
- **Frontend:** `EncabezadoTrasladoPage` (recepción) deja de pedir la
  sección "Entrega del paciente" por completo. `ClinicoTrasladoPage`
  (estado del paciente) agrega esos 5 campos al formulario inline de
  "Cerrar atención", justo antes del PIN — mismo lugar y mismo
  criterio que ya usa SOAT con la hora de entrega. Al confirmar el
  cierre, se reenvía el encabezado completo (cargado al entrar a la
  pantalla, igual que `encabezadoCargado` en
  `ClinicoAccidenteSoatPage`) con la entrega ya puesta, se guarda lo
  clínico, y recién ahí se cierra — mismo orden de tres pasos que ya
  usa SOAT.
- Si se vuelve a editar la recepción después de que la entrega ya
  quedó guardada (p. ej. una corrección de administrador post-cierre,
  ADR-0012), `EncabezadoTrasladoPage` preserva la entrega existente en
  vez de pisarla con `null` — mismo mecanismo que
  `horaEntregaExistente` en `EncabezadoAccidenteSoatPage`.
- El PDF (ADR-0011) se regenera en cada guardado del encabezado, no
  solo al cerrar — así que puede renderizarse con la entrega todavía
  en `None`. `_fecha_hora()` y el resto del contexto del PDF muestran
  esos campos en blanco (`or '—'`, mismo criterio que ya usan
  `acompanante_telefono` y otros campos opcionales del papel) en vez
  de romper con `AttributeError`.

De paso (mismo issue, feedback de QA): el textarea de "Evolución
médica" (`nota_medica`) en `ClinicoTrasladoPage` se bloquea con el
mismo criterio que ya tenía la firma de quien evolucionó
(`evolucionado_por` vacío) — no tiene sentido dejar escribir una nota
médica sin nadie a quien atribuírsela. En básico el médico puede no
haber participado (el bloqueo aplica); en medicalizado siempre hay uno
(`nota_medica` ya es obligatoria para cerrar, ver arriba), así que ahí
el bloqueo no se nota en la práctica.

## Alternativas consideradas

- **Endpoint nuevo para "entrega del paciente"**, separado del PUT de
  encabezado — descartado: el patrón de SOAT con `hora_entrega` ya
  prueba que no hace falta, y mantiene un solo lugar (el encabezado)
  como fuente de verdad para todos esos datos, en vez de partir el
  registro en más piezas.
- **PATCH parcial** en vez de reenviar el encabezado completo —
  descartado por la misma razón que ya descartó esto ADR-0006: la
  app offline (ADR-0008) y la corrección con historial (ADR-0012) ya
  asumen "siempre el formulario completo" en todos los formatos;
  mezclar un PATCH parcial solo para este caso complicaría la cola de
  sincronización sin necesidad real.
- **No validar la entrega en `_campos_faltantes_para_cerrar`**, dejar
  que el frontend sea la única barrera (como hace SOAT con
  `hora_entrega`) — descartado: traslado ya trata esa función como la
  validación autoritativa de cierre (a diferencia de SOAT, que solo
  valida ahí identidad/triage/Glasgow/etc. y deja la hora de entrega
  fuera), así que se mantiene consistente con ese criterio existente
  en vez de introducir una excepción.

## Consecuencias

- Un traslado recién recibido puede guardar su encabezado sin saber
  todavía nada de la entrega — el flujo ya no obliga a adivinar datos
  que no existen al empezar.
- Toda atención de traslado cerrada *antes* de este cambio ya tenía
  entrega completa (era obligatoria), así que no hace falta backfill:
  la migración solo relaja la restricción NOT NULL, no toca datos.
- El PDF de un traslado todavía abierto (no cerrado) va a mostrar la
  sección de entrega en blanco hasta el momento del cierre — es el
  comportamiento esperado, no un bug.
- Mismo punto pendiente que ya dejó ADR-0010 para SOAT: si el
  dispositivo pierde señal justo al cerrar, el guardado del
  encabezado-con-entrega y el cierre se encolan por separado (mismo
  mecanismo ya existente, `ClinicoTrasladoPage` ya guarda lo clínico
  por su cuenta en ese caso) — no se agrega ninguna cola nueva para
  esto.
