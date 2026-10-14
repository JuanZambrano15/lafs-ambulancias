# ADR-0013: Panel web del administrador — stack, alcance y despliegue
 
- **Fecha:** 2026-10-13
- **Estado:** Aceptada
 
## Contexto
 
El issue #4 ("CRUD de usuarios, roles y empleados") pedía "endpoints
y pantallas", pero solo se entregó el backend (ver ADR-0003, que no
menciona frontend en ningún punto). Hoy no existe ningún panel web,
de ningún tipo: `app/` es la app Android empaquetada con Capacitor
para auxiliar/médico/conductor, no sirve para que un administrador
cree usuarios desde un navegador. En la práctica, esto bloqueaba
hacer pruebas manuales de la app: no había forma de crear un usuario
conductor o médico de prueba sin tocar la base de datos a mano.
 
El issue #15 ("Panel web del administrador: pendientes y alertas
básicas") también depende de que exista este panel — por eso este
issue (#49) va primero en el backlog, y #15 se construye encima.
 
Había tres preguntas sin resolver:
 
1. ¿Con qué stack se construye el panel? El ADR-0001 solo decidió el
   backend; nunca se decidió nada de frontend web (el de `app/` es
   para la app móvil, con Capacitor).
2. ¿Qué entra en esta primera entrega: solo usuarios, o también
   empleados y roles?
3. ¿Cómo se sirve en producción — dominio aparte, subruta de la
   misma API, o nada todavía (dev únicamente)?
 
## Decisión
 
**Stack: React + Vite + TypeScript + Tailwind, proyecto nuevo
`web/`, hermano de `app/`.** Mismas convenciones de código que
`app/` (mismo patrón de `apiFetch`/`AuthContext`/`ProtectedRoute`,
mismo ESLint/Vitest/Testing Library) para no introducir un segundo
estilo de frontend en el repo — la única diferencia real es la
persistencia de tokens: `localStorage` en vez de
`@capacitor/preferences`, porque este panel corre siempre en un
navegador de escritorio normal, nunca empaquetado.
 
**Alcance de este issue: las tres pantallas completas (usuarios,
empleados, roles), no solo usuarios.** Los tres CRUD ya existen en el
backend desde el issue #4 y comparten el mismo patrón de pantalla
(tabla + formulario de alta + edición inline) — partirlos en tres
issues separados no bajaba el riesgo de nada, solo alargaba la
entrega. El panel de pendientes/alertas (issue #15) sigue aparte.
 
**`ProtectedRoute` nuevo, no el de `app/`:** mismo patrón de tres
casos (cargando / sin sesión / debe cambiar contraseña), más un
cuarto caso que no existe en la app móvil: sesión válida pero sin el
rol `administrador` — se muestra un aviso en la misma pantalla, no se
redirige a ningún lado (este panel no tiene una pantalla "para
conductor" a la que mandarlo). No se incluye el paso de "configurar
PIN" (issue #12): ese flujo es solo para quien firma un formato desde
la app móvil.
 
**La contraseña inicial de un usuario nuevo no se pide en el
formulario:** el backend ya la genera igual al documento (ADR-0003)
— el formulario de creación de usuario no tiene ningún campo de
contraseña, y muestra un mensaje después de crear recordando que la
contraseña inicial es el documento.
 
**Despliegue: Caddy sirve el build de `web/` bajo `/admin/` del mismo
dominio que la API, sin subdominio ni servidor Node en producción.**
Un servicio nuevo en `docker-compose.yml` (`web-build`) compila el
panel a estáticos con Vite (`base: '/admin/'`) y los copia, en cada
ejecución, a un volumen (`web_dist`) que `caddy` monta de solo
lectura — no se depende del sembrado automático de un volumen vacío
que Docker hace la primera vez que se usa, porque eso dejaría
builds viejos sirviéndose para siempre después de cada
`docker compose up --build` (ver comentario en `web/Dockerfile`). El
`Caddyfile` agrega un bloque `handle /admin*` con `file_server` y
`try_files` apuntando a `/admin/index.html` para que las rutas de
`react-router` (`/admin/usuarios`, etc.) funcionen al recargar la
página. No hay DNS ni subdominio que configurar — el dominio real de
producción se resuelve en el issue #26 (despliegue en servidor), este
ADR solo deja la subruta lista para cuando eso exista.
 
El CORS del backend (`cors_origins`) se amplía con
`http://localhost:5174` (el puerto de `npm run dev` de este panel,
distinto al 5173 de `app/` para poder correr los dos a la vez).
 
## Alternativas consideradas
 
- **Reutilizar `app/` para esto** (una sección "admin" dentro de la
  misma app Capacitor) — descartado: `app/` está pensada para
  tablets/Android, con Capacitor como dependencia que no aplica a un
  panel de escritorio, y mezclaría dos audiencias muy distintas
  (personal de campo vs. administrador) en el mismo proyecto.
- **Server-rendered con Jinja2** (reutilizando lo que ya existe para
  el PDF del issue #13) — descartado: menos interactivo para un CRUD
  con bastante estado de formulario (selección de roles, edición
  inline), y el cliente prefirió una SPA separada.
- **Subdominio dedicado** (`admin.dominio.com`) en vez de subruta —
  descartado por ahora: necesita DNS y un certificado TLS aparte que
  todavía no existen (se resuelven en el issue #26); una subruta del
  mismo dominio no necesita nada de eso y es trivial de mover a un
  subdominio después si hace falta.
- **Solo la pantalla de usuarios en este issue, empleados/roles
  después** — descartado por decisión explícita del cliente: los tres
  CRUD entran juntos en esta entrega.
 
## Consecuencias
 
- Dos proyectos de frontend en el repo (`app/`, `web/`) con
  `package.json`/`node_modules` propios — more superficie de
  mantenimiento (dos `npm install`, dos pipelines de CI), pero cada
  uno sirve a una audiencia y un empaquetado distintos, y comparten
  convenciones de código.
- El panel no tiene todavía ninguna pantalla en `/` — solo redirige a
  `/usuarios`. La pantalla de inicio real (pendientes y alertas) es
  el issue #15.
- El despliegue real a un VPS con dominio y TLS sigue pendiente del
  issue #26; este ADR solo deja la subruta `/admin` lista dentro de
  `docker-compose.yml`/`Caddyfile` para cuando eso se resuelva.
- Esta entrega se verificó con `docker compose config` (el `compose`
  queda bien formado, con la dependencia `service_completed_successfully`
  de `web-build` antes de `caddy`) pero no se pudo levantar un `caddy`
  real en este entorno de verificación (sin daemon de Docker
  disponible) — queda por confirmar en la máquina del desarrollador
  con `docker compose up` que `/admin` sirve el panel correctamente.