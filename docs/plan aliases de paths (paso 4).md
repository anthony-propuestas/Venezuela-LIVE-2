Plan aliases de paths (paso 4)

Este paso del plan se ejecuto con EXITO

Hecho
Copiado api.js → src/client/services/api.service.js
Mismo contenido; el original se mantuvo hasta actualizar los imports.

Imports actualizados (alias @client/services/api.service):

app.jsx: import * as api from '@client/services/api.service';
Profile.jsx: import * as api from '@client/services/api.service';
Eliminado el archivo original api.js de la raíz.

Verificación

npm run build termina correctamente (Vite + Pages Functions).
No hay errores de linter en los archivos tocados.
No quedan imports de ./api en el proyecto (solo un comentario en vite.config.js que menciona “api.js”; opcional actualizarlo a “api.service.js”).
Comprobar en el navegador
Según el todo:

Ejecuta npm run dev.
Con VITE_GOOGLE_AUTH_PAUSED=true (o modo pruebas), inicia sesión.
Entra al perfil y revisa en DevTools → Network que las llamadas a /api/profile (y resto de /api/...) respondan bien.