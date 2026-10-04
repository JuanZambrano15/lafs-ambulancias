# ADR-0004: App Android — stack, sesión y navegación por rol
 
- **Fecha:** 2026-10-03
- **Estado:** Aceptada
 
## Contexto
 
El issue #6 pide la primera pieza de frontend del proyecto: una app
Android con login contra la API y una navegación base que dependa del
rol del usuario. Esto obliga a resolver varias preguntas nuevas:
 
1. Qué stack usar para construir y empaquetar la app.
2. Dónde y cómo persistir los tokens de sesión en el dispositivo.
3. Cómo sabe el frontend qué roles tiene el usuario logueado, si
   `POST /auth/login` no los devuelve.
 
## Decisión
 
**Stack:** React + Vite + TypeScript, empaquetado como app Android con
[Capacitor](https://capacitorjs.com/). Tailwind CSS para estilos (se
necesitan objetivos táctiles grandes, pensando en tablets usadas
durante el servicio de ambulancia). ESLint + TypeScript en modo
estricto para lint/typecheck, y Vitest + Testing Library para pruebas
— replicando a propósito el mismo nivel de rigor que ya tiene el
backend con `ruff`/`mypy`/`pytest`.
 
**Persistencia de sesión:** los tokens (access y refresh) se guardan
con `@capacitor/preferences`, no `localStorage`. En una WebView
empaquetada con Capacitor, `localStorage` puede perderse en formas que
`Preferences` evita (actualización de la app, limpieza de caché del
sistema operativo), y es además la API que Capacitor recomienda para
este caso.
 
**Perfil y roles del usuario (`GET /auth/me`):** `TokenResponse` (la
respuesta de `/auth/login`) nunca tuvo los roles del usuario — solo
tokens y dos flags (`pin_configurado`, `debe_cambiar_password`). El
único endpoint existente que sí devuelve roles es `GET /usuarios/{id}`,
pero está restringido a administrador, así que un auxiliar, conductor,
médico o contador no lo puede usar para consultar su propio perfil. Se
agrega `GET /auth/me`, protegido solo por `CurrentUser` (sesión válida,
sin chequeo de rol — cada usuario únicamente puede consultar su propia
información), que devuelve un `MeResponse` con `documento`, `activo`,
`empleado_id`, `debe_cambiar_password`, `pin_configurado` y `roles`.
El frontend lo llama al arrancar (para restaurar sesión) y después de
cambiar la contraseña, y decide qué secciones de la navegación mostrar
según los roles que reciba.
 
**Cambio de contraseña obligatorio:** si `debe_cambiar_password` es
`true` (ver ADR-0003), el frontend redirige a una pantalla de cambio de
contraseña antes de dejar ver cualquier otra cosa, usando el mismo
`PUT /auth/password` que ya existía.
 
## Alternativas consideradas
 
- **Guardar los roles dentro del JWT** — descartado: el access token
  ya se usa en varios endpoints y cambiarle el payload es un cambio más
  invasivo que agregar un endpoint nuevo; además los roles pueden
  cambiar mientras el token sigue vigente (hasta 15 minutos), y
  `/auth/me` siempre refleja el estado actual en la base de datos.
- **Pedir el perfil completo desde `GET /usuarios/{id}` reusando el
  endpoint de administrador** — descartado: requeriría relajar su
  chequeo de rol (`require_admin`) o duplicar lógica, cuando un
  endpoint nuevo y más simple (`GET /auth/me`) resuelve exactamente lo
  que hace falta sin tocar un endpoint ya usado por el panel de
  administración.
- **Capacitor Storage / `localStorage`** — descartado por las razones
  de persistencia explicadas arriba.
- **Material UI en vez de Tailwind** — descartado: Tailwind da control
  directo sobre el tamaño de los objetivos táctiles sin el overhead de
  un sistema de diseño genérico pensado para escritorio.
 
## Consecuencias
 
- Cualquier pantalla nueva que necesite saber el rol del usuario usa
  `useAuth()` (`src/auth/AuthContext.tsx`), no vuelve a llamar
  `/auth/me` por su cuenta.
- `MeResponse` y `TokenResponse` ahora tienen una responsabilidad
  distinta: el segundo solo entrega credenciales nuevas, el primero es
  la fuente de verdad del perfil. Si más adelante se agrega un dato de
  perfil nuevo (nombre, foto), va en `MeResponse`.
- La navegación por rol (`SECCIONES_POR_ROL` en
  `src/pages/HomePage.tsx`) es, por ahora, un mapeo a mano en el
  frontend. Si el número de roles o de secciones crece mucho, vale la
  pena evaluar que el backend exponga qué secciones le corresponden a
  cada rol, en vez de mantener el mapeo en dos lugares.
