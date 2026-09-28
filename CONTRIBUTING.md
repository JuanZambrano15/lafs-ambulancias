# Guía de trabajo (proyecto de un solo desarrollador)

Este repo lo mantiene una sola persona, pero sigue un flujo estándar de
equipo para que el historial quede limpio y profesional.

## Flujo de ramas

1. Cada tarea tiene un issue en el backlog (ver pestaña Issues / Projects).
2. Rama nueva desde `main`, con el número del issue en el nombre:
   ```
   git checkout -b 12-cierre-formato-con-pin
   ```
3. Commits pequeños y frecuentes (ver convención abajo).
4. Push de la rama y Pull Request hacia `main`, con `Closes #12` en la
   descripción.
5. Esperar a que CI pase en verde antes de mergear.
6. Merge con **squash** (deja un solo commit limpio por feature en `main`).
7. Borrar la rama después del merge.

## Convención de commits

Se usa [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/):

| Prefijo    | Cuándo usarlo                                      |
|------------|-----------------------------------------------------|
| `feat:`    | Funcionalidad nueva                                 |
| `fix:`     | Corrección de un bug                                |
| `docs:`    | Solo documentación                                  |
| `refactor:`| Cambio interno sin alterar comportamiento           |
| `test:`    | Agregar o corregir pruebas                          |
| `chore:`   | Configuración, dependencias, CI                     |

Ejemplo:
```
feat(app): guardar formato de traslado sin conexión

Implementa el almacenamiento local con SQLite dentro del WebView de
Capacitor y la sincronización al reconectar en el garaje.

Closes #10
```

## Versionado

Al cerrar cada fase del proyecto (ver el documento de diseño), se crea un
tag y un release en GitHub:

```
git tag -a v0.1.0 -m "Fase 1: MVP de traslados"
git push origin v0.1.0
```

Esto deja un historial de entregas verificable, útil tanto para el
cliente como para mostrar el progreso del proyecto.
