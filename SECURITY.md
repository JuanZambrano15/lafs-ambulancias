# Política de seguridad

Este sistema maneja datos de salud (historia clínica de traslados y
atención de accidentes), por lo que la Ley 1581 de 2012 (protección de
datos personales, Colombia) y buenas prácticas de seguridad aplican desde
el diseño, no como algo agregado al final.

## Principios que sigue el proyecto

- **Nunca hay secretos en el código.** Contraseñas, claves JWT y
  credenciales de correo viven solo en `.env` (fuera de git) o en los
  secretos del entorno de despliegue. `.env.example` documenta qué
  variables existen, nunca sus valores reales.
- **Contraseñas con Argon2**, no MD5/SHA1/SHA256 planos ni bcrypt viejo.
  Ver `app/core/security.py`.
- **JWT de vida corta** (15 min de acceso, refresh de 7 días), para que un
  token robado tenga una ventana de uso pequeña.
- **PIN de firma independiente de la contraseña**: comprometer una no
  compromete la otra.
- **Los permisos se validan siempre en el servidor**, nunca solo en la
  app — la app puede ser manipulada, el servidor es la única fuente de
  verdad.
- **Nada se borra de la base de datos.** Los registros se anulan o
  desactivan; toda corrección queda en `audit_log`. Esto es tanto una
  regla de negocio (trazabilidad clínica) como de seguridad (no hay forma
  de borrar evidencia de un cambio indebido).
- **HTTPS siempre**, certificados automáticos vía Caddy; sin puertos
  abiertos salvo 80, 443 y SSH con llave (sin contraseña).
- **La base de datos y el volumen de archivos nunca se exponen a
  internet** — solo son alcanzables desde la red interna de Docker.
- **Copias de seguridad diarias cifradas**, fuera del servidor.

## Reportar una vulnerabilidad

Este es un proyecto de un solo desarrollador para un cliente específico,
sin programa público de bug bounty. Si encuentras un problema de
seguridad, abre un Issue marcado como privado o contacta directamente al
mantenedor del repositorio en vez de hacerlo público en un Issue normal.

## Dependencias

Las dependencias de Python quedan fijadas por versión exacta en
`requirements.txt` / `requirements-dev.txt` (no rangos abiertos), para que
una actualización de una librería no cambie el comportamiento del sistema
sin que se revise antes.
