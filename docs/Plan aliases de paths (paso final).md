Plan aliases de paths (paso final)

Todo fue exitoso

1. Sin referencias huérfanas a la raíz
En src/ solo hay imports from './' dentro de cada capa (./domain/..., ./middlewares/..., etc.).
No quedan imports a archivos antiguos de la raíz (api, login, Profile); el cliente usa @client/....
2. Imports que suben niveles (../)
En .jsx y .js: 0 resultados.
En .ts del server sí hay ../ (p. ej. en middlewares y repositories), coherente con la estructura de carpetas.
3. Build de producción
npm run build termina bien: Vite + Pages Functions, sin "Could not resolve".
4. Worker responde
Con npm run dev:worker en segundo plano, http://localhost:8787/api/profile devuelve JSON: {"error":"UNAUTHORIZED","message":"No autorizado. Inicia sesión de nuevo."} (correcto sin token).
5. Frontend levanta
Con npm run dev en segundo plano, http://localhost:5173 responde y el HTML contiene "Venezuela" (count > 0).
6. Deploy
npm run deploy completado. Preview: https://d360a563.venezuela-live-2.pages.dev