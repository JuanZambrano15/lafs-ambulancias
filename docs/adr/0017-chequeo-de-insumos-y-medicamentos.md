# ADR-0017: Chequeo semanal de insumos y medicamentos con catálogo y mínimos por móvil

- **Fecha:** 2026-11-13
- **Estado:** Aceptada

## Contexto

El issue #20 pide un catálogo de ítems con el **mínimo requerido por
ambulancia** y un chequeo que compare **lo encontrado contra ese
mínimo**. La fuente es el Excel `Inventarios_ambulancias.xlsx`, en la
parte que el ADR-0016 dejó fuera: respiratorio, pediátrico,
circulatorio, quirúrgico, trauma, equipos y medicamentos.

Las listas **no son iguales** entre móviles: M01 tiene unos 106 ítems
con cantidad, M02 111, el Iveco 96, y la hoja M03 solo trae la parte
del vehículo. Por eso el catálogo es por ambulancia y no una sola lista
global. Las cantidades de medicamentos vienen como número ("5") en M01 y
como texto ("5 amp", "1 blíster") en M02 e Iveco.

## Decisión

- **Catálogo en base de datos, editable.** Tabla `insumo_catalogo`
  (`ambulancia_id`, `categoria`, `nombre`, `minimo`, `unidad`, `orden`;
  el nombre es único dentro de cada móvil). El administrador lo mantiene
  desde el panel web: agregar, cambiar y quitar ítems y mínimos. No se
  dejó fijo en el código porque el inventario cambia (un medicamento
  nuevo, otro mínimo) y cada cambio no debe requerir una versión nueva.
- **Plantillas del Excel.** Para no digitar ~100 ítems por móvil, hay tres
  plantillas (M01, M02, Iveco) en `app/core/catalogo_insumos_inicial.py`,
  que el administrador carga con un botón en un móvil sin ítems. Solo se
  carga en un catálogo vacío, para no pisar lo ya ajustado. Al pasar el
  Excel se corrigió la ortografía ("Espadagrapo" → "Esparadrapo",
  "Ventury" → "Venturi", "Aloperidol" → "Haloperidol", etc.); lo que no
  traía cantidad quedó con mínimo 1; los tubos endotraqueales de la
  sección pediátrica, que decían "adulto", quedaron como pediátricos; las
  dos balas de oxígeno quedaron como "Bala de oxígeno 1" y "2"; y en M02
  e Iveco los sueros, que aparecían dos veces (circulatorio y
  medicamentos), quedaron solo en circulatorio. Todo es ajustable desde el
  panel. M03 no tiene plantilla: el administrador la arma o la copia a
  mano.
- **Mínimo y unidad.** `minimo` es un entero (0 o más). `unidad` (amp,
  blíster, vial, bolsa…) es solo para mostrar; no cambia la comparación.
- **Chequeo.** Tabla `chequeo_insumos`, una fila por chequeo y por
  ambulancia, con los ítems en JSON. Cada ítem guarda **una copia** de
  nombre, categoría, unidad y mínimo del momento, además de la cantidad
  `encontrado`, para que editar o borrar el catálogo después no altere el
  historial. `faltante = encontrado < minimo`; `tiene_faltantes` y
  `total_faltantes` quedan redundantes para filtrar sin abrir el JSON (los
  usarán el #21 y el #23). El servidor exige cada ítem del catálogo del
  móvil exactamente una vez, y rechaza el chequeo si el móvil no tiene
  catálogo.
- **Qué se registra.** La cantidad encontrada, no un "completo /
  incompleto": es lo que pide el issue y deja ver cuánto falta.
- **Frecuencia.** La misma constante del chequeo de vehículo
  (`FRECUENCIA_CHEQUEO_DIAS = 7`): cambiarla cambia los dos chequeos. Un
  móvil está "al día" si su último chequeo de insumos fue hace menos de 7
  días (hora de Colombia).
- **Quién.** Hace el chequeo el rol `auxiliar_enfermeria`. En la app todo
  arranca en el mínimo y el auxiliar corrige lo que encuentre de menos
  (son más de 100 ítems y lo normal es que estén completos); el ítem por
  debajo del mínimo se pinta en rojo con "Faltan N". El administrador ve
  el catálogo, el estado por móvil y el historial; el contador no.
- **Sin PDF.**

## Alternativas consideradas

- *Catálogo fijo en el código*: más simple, pero cada ajuste de inventario
  sería un cambio de código y un despliegue.
- *Una sola lista global con mínimos por móvil*: las listas difieren de
  verdad (equipos de parto, fentanilo, midazolam solo en algunos), así que
  habría ítems "no aplica" por todos lados.
- *Campos de cantidad vacíos al iniciar el chequeo*: obliga a contar de
  verdad, pero son más de 100 campos por móvil por semana; se prefirió
  el mínimo como valor inicial. Si en la práctica se confirma sin contar,
  se puede cambiar a vacío sin tocar el backend.
- *Guardar solo el `insumo_id` en el chequeo*: el historial cambiaría al
  editar el catálogo.

## Consecuencias

- Hace falta que el administrador cargue una plantilla (o arme la lista)
  en cada móvil antes de que el auxiliar pueda chequearlo; la app lo
  avisa ("Sin lista de insumos").
- Quedan para issues propios: las alertas por faltantes (#21), los lotes,
  INVIMA y vencimientos (#22) y las existencias y alertas de stock (#23).
- Como el chequeo guarda su propia copia de los datos, borrar un ítem del
  catálogo es seguro.
