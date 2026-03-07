Plan aliases de paths (paso 5)

Los Cambios en este paso fueron exitosos

Hecho
login.jsx movido → src/client/pages/Login/Login.page.jsx
Solo usa react, @react-oauth/google y lucide-react. Sin cambios de imports internos.

Profile.jsx movido → src/client/pages/Profile/Profile.page.jsx
Import de auth actualizado: ./login → @client/pages/Login/Login.page. El resto (ErrorContext, api.service) ya usaba aliases.

app.jsx actualizado

import Login, { LoginBypass, getStoredAuth, clearAuth, AUTH_PAUSED } from '@client/pages/Login/Login.page'
import Profile from '@client/pages/Profile/Profile.page'
main.jsx actualizado

import { AUTH_PAUSED } from '@client/pages/Login/Login.page'
Verificación

npm run build termina correctamente (Vite + Pages Functions).
Sin errores de linter en los archivos tocados.