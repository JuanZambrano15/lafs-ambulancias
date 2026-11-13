# ADR-0016: Chequeo semanal del vehículo y semáforo de vigencias

- **Fecha:** 2026-11-12
- **Estado:** Aceptada

## Contexto

El issue #19 pide que el conductor haga el chequeo de su móvil y que se
vean los vencimientos del SOAT y la tecnomecánica de ese móvil. La
gerencia aclaró tres cosas: por ahora el chequeo se hace **una vez por
semana** (mientras se define el tiempo definitivo), el panel web debe
mostrar las fechas de vencimiento con un **semáforo**, y **no hace falta
PDF** como en los formatos de traslado y SOAT.

La fuente del checklist es la hoja "Lista de chequeo ambulancia" de
`Inventarios_ambulancias.xlsx`. Esa hoja mezcla dos cosas: la sección de
vehículo (37 filas, de "Cojinería" a "Tacos", etiquetada "Conductor" en
la hoja del Iveco) y los insumos y medicamentos con cantidades
(respiratorio, circulatorio, quirúrgico, trauma, medicamentos). Esto
último es el issue #20, no este.

## Decisión

- **Alcance:** solo las 37 filas de vehículo. Los nombres se corrigieron
  de ortografía ("Bolante" → "Volante", "cavina" → "cabina", "tracera" →
  "trasera"). El catálogo vive en el backend
  (`app/core/chequeo_vehiculo.py`) y la app lo pide, para tener una sola
  fuente.
- **Modelo:** tabla `chequeo_vehiculo` (una fila por chequeo, por
  ambulancia, no por paciente: no es un tipo de `Atencion`, como ya
  anticipaba el ADR-0002). Los ítems van en JSON con el texto tal cual se
  mostró, y `tiene_fallas` queda redundante para poder filtrar sin abrir
  el JSON (lo necesitará el issue #21, alertas de chequeo con fallas).
- **Respuesta por ítem:** "Bien" o "Falla"; la falla exige describir qué
  pasa (una falla sin descripción no sirve a quien la arregla). En la app
  todo arranca en "Bien": son 37 ítems y lo normal es que estén bien.
  Quien diligencia puede cambiar lo que no esté en orden.
- **Frecuencia:** `FRECUENCIA_CHEQUEO_DIAS = 7`, una sola constante. Un
  móvil está "al día" si su último chequeo fue hace menos de 7 días
  (ventana móvil, no semana calendario); la fecha se calcula en hora de
  Colombia.
- **Semáforo de vigencias** (lo calcula el backend, igual para la app y
  el panel): vencido o 15 días o menos → rojo; hasta 30 días → amarillo;
  más de 30 → verde. Los umbrales son constantes (`DIAS_ROJO`,
  `DIAS_AMARILLO`). El color nunca va solo: siempre lleva el texto
  ("Vence en 20 días", "Vencido hace 3 días").
- **Quién:** hace el chequeo el rol conductor; el administrador y el
  contador ven el estado de la flota (`GET /chequeos-vehiculo/flota`);
  el historial y el detalle son para administrador y contador. En el
  panel web la pantalla "Estado de la flota" es solo del administrador,
  y el dashboard muestra alertas (vigencias en amarillo o rojo, chequeo
  pendiente y fallas del último chequeo).
- **Sin PDF.**

## Alternativas consideradas

- Incluir también insumos y medicamentos — es el issue #20, con
  cantidades y mínimos por móvil; mezclarlos haría un chequeo de más de
  150 filas y mezclaría quién lo hace (el conductor revisa el vehículo,
  el auxiliar el material clínico).
- Marcar cada ítem como pendiente hasta que se responda — más tiempo de
  llenado sin mucho valor; se prefirió "Bien" por defecto.
- Calcular el semáforo en cada pantalla — duplicaría la regla en dos
  frontends; por eso viene del backend.
- Semana calendaria (lunes a domingo) — un chequeo hecho el domingo
  contaría como "de la semana" un solo día; la ventana de 7 días es más
  simple de explicar y de cambiar.

## Consecuencias

- El tiempo definitivo del chequeo se cambia en una sola constante.
- Quedan fuera por ahora: guardar el chequeo sin conexión (hoy exige
  señal, a diferencia de los formatos, ADR-0008), avisos de chequeo con
  fallas (#21), y la vista del contador en el panel.
- Los vencimientos siguen guardándose en `ambulancia`; no hay todavía una
  pantalla del administrador para editarlos (es el CRUD de ambulancias,
  sin interfaz en el panel).
