# ADR-0003: Gestión de usuarios, roles y empleados
 
- **Fecha:** 2026-09-30
- **Estado:** Aceptada
 
## Contexto
 
El issue #4 pide que el administrador pueda crear/editar usuarios,
asignarles roles y mantener la lista de empleados. Esto obliga a
resolver tres preguntas que no estaban cerradas todavía:
 
1. `Usuario` (credencial de acceso) y `Empleado` (persona real de la
   empresa) son entidades separadas desde el issue #2. ¿Cómo se maneja
   personal que no es de planta — un médico o auxiliar ocasional —
   dado que igual puede aparecer como conductor o responsable de una
   `Atencion`?
2. Cuando el administrador crea un usuario nuevo, ¿quién define la
   contraseña inicial?
3. Los roles viven como filas de tabla (no como Enum) para que el
   admin los pueda gestionar por CRUD — pero eso significa que ningún
   usuario tiene el rol "administrador" hasta que *alguien* con ese rol
   lo asigne. ¿Cómo arranca el sistema la primera vez?
 
## Decisión
 
**Empleado vs. Usuario ocasional:** la vinculación laboral (planta u
ocasional) es un dato de `Empleado`, no una entidad distinta ni una
razón para no crear el registro. Cualquier persona que pueda figurar
como conductor o responsable de un servicio existe como `Empleado`,
tenga o no una cuenta para loguearse. Se agrega `tipo_vinculacion`
(`planta` / `ocasional`) a `Empleado`. Que esa persona además tenga un
`Usuario` es una decisión aparte, independiente de su vinculación.
 
**Contraseña inicial:** no la define el administrador a mano. Se
genera automáticamente igual al `documento` del usuario, y el usuario
queda marcado con `debe_cambiar_password=true`. El login devuelve ese
flag (igual que ya hacía con `pin_configurado`) para que el frontend
fuerce la pantalla de cambio de contraseña en el primer ingreso. El
mismo mecanismo (`POST /usuarios/{id}/resetear-password`) sirve para
resetear la contraseña de alguien que la olvidó, sin necesitar un
flujo aparte de recuperación por ahora.
 
**Bootstrap del primer administrador:** la migración de Alembic de
este issue siembra los 5 roles conocidos del negocio (administrador,
auxiliar_enfermeria, medico, conductor, contador) y un usuario
administrador inicial, con documento y contraseña tomados de variables
de entorno (`ADMIN_SEED_DOCUMENTO`, `ADMIN_SEED_PASSWORD`). Ese
usuario sigue la misma regla de cualquier otro: arranca con
`debe_cambiar_password=true`.
 
**Borrado:** tanto `Usuario` como `Empleado` usan borrado suave
(`activo=false`) en vez de borrar la fila. Un empleado o usuario
desactivado puede seguir referenciado desde atenciones ya cerradas;
borrarlo de verdad rompería ese historial. `Rol` es la excepción: se
borra de verdad, pero se rechaza con 409 si todavía tiene usuarios
asignados.
 
## Alternativas consideradas
 
- **El admin define la contraseña inicial a mano** — descartado: obliga
  a inventar y comunicar una contraseña por cada usuario nuevo, cuando
  el documento ya es un dato único que la persona conoce de memoria.
- **Contraseña temporal aleatoria** — descartado por ahora: es más
  seguro, pero obliga a un canal para comunicarla (SMS/correo) que el
  proyecto no tiene todavía; se puede migrar a esto más adelante sin
  romper el flujo (`debe_cambiar_password` ya existe).
- **Insertar el primer admin a mano por SQL** — descartado: es un paso
  manual fácil de olvidar en un despliegue nuevo, y además no sirve
  para que `make test`/CI levanten un sistema utilizable de punta a
  punta.
- **Borrado real de usuario/empleado** — descartado: rompe las FK de
  `Atencion.conductor_id`/`responsable_id` hacia empleados ya usados en
  servicios pasados.
 
## Consecuencias
 
- Queda pendiente (no es parte de este issue): un flujo de
  recuperación de contraseña por autoservicio (sin pasar por el
  admin) si el cliente lo pide más adelante.
- `ADMIN_SEED_DOCUMENTO`/`ADMIN_SEED_PASSWORD` son variables
  obligatorias desde esta migración: cualquier entorno nuevo (incluido
  CI) necesita definirlas antes de migrar.
- El nombre de rol "administrador" queda como una cadena mágica que
  varios endpoints verifican (`require_admin` en `app/api/deps.py`).
  Si el cliente pide renombrarlo, es un solo punto de cambio.
