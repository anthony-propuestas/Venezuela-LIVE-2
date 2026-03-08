Plan de aliases de paths (paso 9)

Todos los cambios aplicados aqui fueron Exitosos

Hecho
Archivos en src/shared/

src/shared/types/profile.types.ts: AchievementItem, GamificationInfo, ProfileResponse (contrato de GET /api/profile).
src/shared/types/api.types.ts: User, ProfileUpdateBody (usuario autenticado y cuerpo de PUT /api/profile).
src/shared/constants.ts: USERNAME_MIN, USERNAME_MAX, USERNAME_REGEX.
Uso en el servidor

src/server/types.ts: reexporta User desde @shared/types/api.types.js (el tipo compartido queda en shared).
src/server/index.ts: importa USERNAME_MIN, USERNAME_MAX, USERNAME_REGEX desde @shared/constants.js y deja de definirlos en el archivo.
Build de Pages Functions

En scripts/build-pages-functions.mjs se añadió el alias de esbuild '@shared': path.join(root, 'src', 'shared') para que las importaciones @shared/... resuelvan correctamente al hacer el bundle.
Verificación

npm run build termina sin errores (Vite + Pages Functions).
No hay errores de linter en los archivos tocados.
TypeScript del servidor sigue compilando bien (sin errores de tipos).   