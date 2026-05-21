CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  subcategories TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO categories (name, slug, subcategories) VALUES
  ('Economía',          'economia',          '["Moneda","Inflación","Impuestos"]'),
  ('Salud',             'salud',             '["Infraestructura","Personal Médico","Insumos"]'),
  ('Seguridad',         'seguridad',         '["Prevención","Cárceles","Policía"]'),
  ('Educación',         'educacion',         '["Docentes","Infraestructura","Currículo"]'),
  ('Servicios Públicos','servicios-publicos', '["Electricidad","Agua","Internet","Transporte"]');
