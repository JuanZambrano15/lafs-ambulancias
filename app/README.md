# L.A.F.S. Ambulancias — App (login y navegación base)

App Android, empaquetada con [Capacitor](https://capacitorjs.com/), hecha
con React + Vite + TypeScript y estilada con Tailwind CSS (pantallas
pensadas para usarse en tablet, con objetivos táctiles grandes).

Cubre el login contra la API, el cambio de contraseña obligatorio en el
primer ingreso, y una navegación base que muestra solo las secciones
que le corresponden al rol (o roles) del usuario — las secciones en sí
(formatos, atención SOAT, chequeos, inventario) se implementan en
issues posteriores.

## Requisitos

- Node 20+
- La API corriendo (ver `../api/README.md`)

## Desarrollo

```bash
npm install
cp .env.example .env   # ajustar VITE_API_URL si la API no corre en localhost:8000
npm run dev
```

## Verificación local

```bash
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run test       # vitest
npm run build      # tsc -b && vite build
```

## Empaquetado Android

```bash
npm run build
npx cap sync android
npx cap open android   # abre el proyecto en Android Studio
```

## Estructura

```
src/
  lib/            cliente HTTP (api.ts), tipos (types.ts), persistencia de tokens (storage.ts)
  auth/           AuthContext: sesión, roles, restaurar/cerrar sesión
  routes/         ProtectedRoute: redirige a /login o /cambiar-password según corresponda
  pages/          LoginPage, CambiarPasswordPage, HomePage
```

## Decisiones

- **Tailwind CSS** en vez de una librería de componentes: se necesitan
  objetivos táctiles grandes para tablets usadas durante el servicio de
  ambulancia, y Tailwind da control directo sobre eso sin el overhead
  de un sistema de diseño genérico.
- **`@capacitor/preferences`** en vez de `localStorage` para los
  tokens: más confiable en Android empaquetado (ver comentario en
  `src/lib/storage.ts`).
- **`GET /auth/me`** (nuevo endpoint del backend, agregado junto con
  esta app): `POST /auth/login` no devuelve los roles del usuario, y
  el único endpoint que sí los devuelve (`GET /usuarios/{id}`) es solo
  para administrador. `/auth/me` solo exige una sesión válida, sin
  chequeo de rol, porque cada usuario únicamente consulta su propia
  información.
