# ADR-0002: Ciclo de vida del servicio y edición de formatos

- **Fecha:** 2026-09-30
- **Estado:** Aceptada

## Contexto

El cliente (30/09/2026) refinó dos reglas que ya estaban anotadas de forma
más genérica en el backlog:

1. Se había dicho que "un formato guardado solo se modifica con permiso
   del administrador, conservando el registro anterior". El cliente
   aclaró que eso no aplica mientras el servicio está en curso: el
   auxiliar de enfermería o médico puede modificar el formato las veces
   que quiera, sin pedir permiso ni dejar rastro de versiones previas,
   **mientras no cierre el servicio**. El cierre lo hace manualmente el
   auxiliar/médico (normalmente al volver al garaje).

2. En atención de accidentes SOAT, el paciente puede no portar
   documentos ni poder identificarse (inconsciente, etc.). En ese caso
   se registra como **NN**. Los datos reales pueden llegar después —vía
   hospital o familiares— y en algunos casos hasta un mes más tarde.
   Esa actualización la autoriza el administrador y debe conservar que
   el registro se recolectó originalmente como NN.

Antes de modelar `Servicio`, `Formato` y `Paciente` (issue #2 en
adelante) conviene dejar explícito cuál es el disparador real de "ya no
se puede editar libremente", porque no es "se guardó el formato" sino
"se cerró el servicio".

## Decisión

El servicio (`Servicio`/`Atencion`) tiene un estado explícito,
`abierto` o `cerrado`, con su `cerrado_en`:

- **Mientras `abierto`:** el auxiliar/médico asignado edita el formato
  libremente, sin permiso de nadie y sin generar historial. Los cambios
  sobrescriben el registro anterior.
- **Al pasar a `cerrado`** (acción explícita del auxiliar/médico, no un
  timeout ni algo automático): cualquier edición posterior requiere
  permiso del administrador y genera una entrada en el historial de
  versiones, conservando el estado anterior del formato completo.

El caso del paciente NN es una aplicación directa de esta misma regla,
no una excepción: el accidente SOAT se cierra con el paciente como NN;
la actualización posterior de sus datos reales es una edición de un
servicio ya cerrado, así que pasa por el mismo camino (permiso del
admin + historial), sin importar que ocurra semanas después. El modelo
de `Paciente` marca explícitamente `identificado: bool` para poder
filtrar en reportes los NN aún pendientes de completar.

## Alternativas consideradas

- **Versionar cada guardado, incluso con el servicio abierto** —
  descartado: el auxiliar puede corregir un campo decenas de veces
  mientras atiende; guardar cada intermedio es ruido puro y no aporta
  trazabilidad real (lo que importa es el estado al cerrar).
- **Cierre automático por tiempo o geocerca (llegar al garaje)** — no
  descartado para el futuro, pero por ahora el cliente pidió que el
  cierre sea una acción explícita del auxiliar/médico; automatizarlo
  es una mejora que se puede agregar después sin romper este modelo
  (el cierre seguiría siendo el mismo evento, solo cambiaría quién lo
  dispara).
- **Un flujo de aprobación especial solo para pacientes NN** —
  descartado: ya existe el mecanismo genérico de "edición post-cierre
  con permiso de admin + historial"; crear un camino aparte solo para
  este caso duplicaría lógica sin necesidad.

## Consecuencias

- `Servicio` necesita `estado` (`abierto`/`cerrado`) y `cerrado_en`;
  la lógica de permisos y versionado del formato se cuelga de ese
  estado, no de un simple `guardado_en`.
- El historial de versiones de un formato solo empieza a llenarse
  después del primer cierre — antes de eso el formato es mutable sin
  rastro, así que no hay que diseñar ese historial para capturar
  "todas las ediciones", solo "todas las ediciones post-cierre".
- Queda pendiente de preguntarle al cliente: cuando se actualiza un
  paciente NN, ¿quiere que el sistema guarde de dónde vino el dato
  (hospital, familiar) como campo estructurado, o alcanza con una nota
  libre en el historial? Se resuelve antes de cerrar el modelo de
  `Paciente` en el issue correspondiente.
