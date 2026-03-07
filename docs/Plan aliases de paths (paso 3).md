Plan de aliases de pahts (paso 3)

Los cambios en este Paso fueron EXITOSOS

Hecho
Movido ErrorContext.jsx
De la raíz a src/client/context/ErrorContext.jsx. El archivo solo usa react y lucide-react, sin imports del proyecto.

Imports actualizados (alias @client/context/ErrorContext):

main.jsx: import { ErrorProvider, ErrorBanner } from '@client/context/ErrorContext'
app.jsx: import { useError } from '@client/context/ErrorContext'
Profile.jsx: import { useError } from '@client/context/ErrorContext'
Verificación

npm run build termina correctamente (Vite + Pages Functions).
Sin errores de linter en los archivos tocados.
Comprobar en el navegador
Ejecuta npm run dev, abre http://localhost:5173 y revisa que:

La app cargue sin errores en consola.
El banner de errores siga funcionando (por ejemplo, provocando un error en la UI o una sesión expirada).
Con eso el Paso 3 queda verificado. Puedes seguir con el siguiente paso del todo.md.

