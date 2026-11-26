# ADR-0018: Edad o fecha de nacimiento, cambio de tripulación al corregir, columna EPS y gestión de ambulancias

- **Fecha:** 2026-11-25
- **Estado:** Aceptada

## Contexto

Una ronda de correcciones pidió cuatro cambios que tocan los formatos de
traslado y de accidente SOAT, los listados de servicios y el panel de
administración:

1. El paciente puede darse por **edad o por fecha de nacimiento**, una u
   otra. El sistema calcula la edad en años cumplidos y la fecha de
   nacimiento **no debe salir en el PDF**.
2. Al corregir un servicio cerrado, el administrador debe poder cambiar la
   **ambulancia, el conductor y el responsable** (auxiliar o médico), sin
   que eso aparezca en la tabla de auditoría, igual que las notas médicas
   y de enfermería.
3. Los listados de traslados (administrador y contador) necesitan una
   columna **EPS**.
4. El panel no tenía forma de **crear, editar ni eliminar ambulancias**.

## Decisión

- **La fecha de nacimiento no se guarda.** El esquema de entrada acepta
  `paciente_fecha_nacimiento` (excluido de `model_dump()` y de las
  respuestas) y un validador la convierte en `paciente_edad`, que es lo
  único que se persiste. Así el PDF, el historial de versiones y los
  reportes siguen funcionando sin cambios y no se almacena un dato
  personal que nadie necesita. No hizo falta migración.
- **Edad a la fecha del servicio.** La edad se calcula contra la fecha de
  recepción del paciente (traslado) o de la atención (SOAT), no contra
  "hoy": corregir un formato meses después no cambia la edad que tenía el
  paciente ese día. Una fecha de nacimiento posterior al servicio se
  rechaza (422). En el traslado se exige edad o fecha; en el SOAT puede
  faltar ambas, porque el paciente puede ser NN.
- **Una sola regla para el cliente.** `app.core.edad.calcular_edad` es la
  referencia; la tablet y el panel replican el cálculo solo para mostrar
  la vista previa mientras se escribe, y el servidor tiene la última
  palabra.
- **Tripulación fuera del historial.** `ambulancia_id`, `conductor_id` y
  `responsable_id` son campos opcionales de las correcciones
  (`exclude=True`, `None` = no cambia). Viven en `Atencion`, no en el
  formato, así que no entran a `FormatoVersion` ni a `_CAMPOS_RASTREABLES`;
  un cambio solo de tripulación no genera fila de versión. Se valida solo
  lo que cambia (la ambulancia existe y está activa; el conductor tiene el
  rol de conductor; el responsable es auxiliar o médico; el conductor no
  puede ser también el responsable), de modo que corregir un servicio
  antiguo cuyo conductor ya está inactivo sigue siendo posible. El
  `motivo` de la corrección se sigue pidiendo siempre.
- **Listas para los selectores.** `/atenciones/conductores-disponibles`
  se abre también al administrador (y a él no se le excluye de la lista,
  a diferencia de quien inicia una atención), y se agrega
  `/atenciones/responsables-disponibles` (auxiliares y médicos activos).
- **Columna EPS.** `AtencionCerradaOut.paciente_eps` y
  `ViajeDetalle.eps` traen la EPS del traslado o, en un SOAT, la
  aseguradora; queda vacía en un NN sin identificar.
- **Gestión de ambulancias.** Nueva pantalla "Ambulancias" (solo
  administrador) sobre el CRUD que ya existía. *Dar de baja* (DELETE, baja
  suave) conserva el historial y se revierte con *Reactivar*
  (`PATCH activa=true`, campo nuevo en `AmbulanciaUpdate`). *Eliminar*
  (`DELETE /ambulancias/{id}/definitivo`) borra de verdad pero solo si la
  ambulancia nunca se usó: con atenciones o chequeos asociados responde
  409 y hay que dejarla de baja. Al eliminar se borra también su catálogo
  de insumos, que no tiene sentido sin el móvil.

## Alternativas consideradas

- *Guardar la fecha de nacimiento y calcular la edad al imprimir*: obliga a
  migrar el modelo, cambia el PDF y el historial, y guarda un dato que el
  cliente no quiere ver impreso.
- *Calcular la edad contra la fecha actual*: la edad de un formato cambiaría
  según cuándo se corrija.
- *Versionar los cambios de tripulación*: lo descartó el cliente; deben
  tratarse como las notas, fuera de la auditoría.
- *Borrado definitivo con cascada sobre las atenciones*: se perdería el
  historial clínico y contable. Es preferible bloquear y dejar la baja.
- *Un solo selector "personal" para conductor y responsable*: las listas
  tienen roles distintos y mezclarlas permitiría combinaciones inválidas.

## Consecuencias

- Cambiar la ambulancia de un servicio ya cerrado no reescribe los
  chequeos ni el catálogo de insumos de ninguna de las dos; solo reasigna
  la atención.
- No queda rastro de quién cambió la tripulación. Si más adelante se
  necesita, requeriría una tabla de auditoría propia.
- La tablet no cambia la tripulación de una atención abierta: eso sigue
  siendo solo del administrador, al corregir el formato ya cerrado.
- La lógica de edad y el selector están duplicados entre `app/` y `web/`
  (no comparten código), con pruebas equivalentes en cada uno.