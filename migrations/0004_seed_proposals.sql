-- Seed inicial de temas y propuestas (desde mock)
INSERT OR IGNORE INTO topics (id, category, subcategory, topic_text) VALUES
  ('t1', 'Educación', 'Docentes', '¿Cómo recuperar el salario de los docentes universitarios y de educación media?'),
  ('t2', 'Economía', 'Moneda', 'Reestructuración de la Moneda Nacional'),
  ('t3', 'Servicios Públicos', 'Electricidad', 'Solución a la crisis eléctrica (SEN)');

INSERT OR IGNORE INTO proposals (id, topic_id, title, description, author, upvotes, downvotes) VALUES
  ('p1', 't1', 'Indexación al valor de la canasta básica', 'Indexar el salario al valor de la canasta básica familiar mediante un fondo mixto financiado por exportaciones petroleras y un nuevo impuesto a transacciones en divisas.', 'EconoVen', 1250, 150),
  ('p2', 't1', 'Privatización parcial del sistema', 'Privatizar parcialmente el sistema universitario y usar los fondos ahorrados para subsidiar directamente el sueldo de los profesores de educación media.', 'Libertad99', 400, 800),
  ('p3', 't1', 'Salario base anclado a aduanas', 'Establecer un salario base de $300 anclado a la recaudación aduanera, eliminando bonos sin incidencia salarial.', 'ProfeGremial', 1050, 50),
  ('p4', 't2', 'Dolarización oficial', 'Dolarización oficial y definitiva de la economía para detener la devaluación y generar confianza en inversores extranjeros.', 'CapitalLibre', 5000, 4950),
  ('p6', 't3', 'Micro-redes solares comunitarias', 'Descentralizar el sistema eléctrico promoviendo micro-redes solares comunitarias subsidiadas en las regiones más afectadas como Zulia y Los Andes.', 'EcoZulia', 850, 50);

INSERT OR IGNORE INTO proposal_notes (id, proposal_id, text, upvotes, downvotes, net_score) VALUES
  ('n1', 'p1', 'Nota: Un impuesto a transacciones en divisas aumentaría la inflación de los productos importados básicos.', 45, 0, 45),
  ('n2', 'p4', 'Nota: La dolarización oficial requiere un acuerdo con la Reserva Federal de EE.UU. que actualmente es inviable por sanciones.', 800, 0, 800);
