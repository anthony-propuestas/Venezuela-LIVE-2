-- Rol de acceso (RBAC) en profiles
-- NOTA: ALTER TABLE ADD COLUMN no es idempotente en SQLite. Solo debe ejecutarse una vez.
-- Este script asume que la tabla profiles ya existe.

ALTER TABLE profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin'));

