# Guía de trabajo (proyecto de un solo desarrollador)
 
Este repo lo mantiene una sola persona, pero sigue un flujo estándar de
equipo para que el historial quede limpio y profesional.
 
## Flujo de ramas
 
1. Cada tarea tiene un issue en el backlog (ver pestaña Issues / Projects).
2. Rama nueva desde `main`, con el prefijo `feat/` (o `fix/` para una
   corrección) seguido del número del issue y un slug corto:
   ```
   git checkout -b feat/12-cierre-formato-con-pin
   ```
3. Commits pequeños y frecuentes, cada uno con su propio alcance
   lógico (modelo/migración, esquema, rutas, tests, docs) — ver
   convención abajo. No se hace squash de la rama antes del PR: el
   historial de commits separados es justamente lo que deja ver el
   proceso en el portafolio.
4. Push de la rama y Pull Request hacia `main`, con `Closes #12` en la
   descripción (en inglés — es la palabra clave que GitHub reconoce
   para cerrar el issue automáticamente, incluso en un PR en español).
5. Esperar a que CI pase en verde antes de mergear.
6. Merge normal ("Create a merge commit"), **no squash**: conserva en
   `main` cada commit de la rama tal como quedó en el PR, en vez de
   aplanarlos en uno solo.
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