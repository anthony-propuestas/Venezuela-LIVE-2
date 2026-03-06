-- Añade campo username único para handles tipo @usuario
-- NOTA: Si ves "duplicate column name: username" al ejecutar de nuevo, es normal:
-- la migración ya se aplicó correctamente. La columna existe; ignora el error.

ALTER TABLE profiles ADD COLUMN username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username) WHERE username IS NOT NULL AND username != '';
