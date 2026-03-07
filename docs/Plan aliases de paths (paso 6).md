Plan de aliases de paths (paso 6)

Lo cambios en este paso fueron exitosos

Hecho
Movidos a src/client/:

app.jsx → src/client/App.jsx
main.jsx → src/client/main.jsx
index.html actualizado

Script de entrada: src="/main.jsx" → src="/src/client/main.jsx"
Vite usa ese entry y genera el bundle en dist/ (p. ej. dist/assets/index-TxLWiQe6.js).
src/client/main.jsx actualizado

import App from './app.jsx' → import App from '@client/App'
Eliminados app.jsx y main.jsx de la raíz del proyecto.

Verificación

npm run build termina correctamente (Vite + Pages Functions).
Sin errores de linter en los archivos tocados.
dist/index.html referencia el JS y CSS generados.