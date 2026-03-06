-- Un usuario por email: evita cuentas duplicadas con el mismo correo.
-- Si falla por "duplicate key" es que ya existen emails repetidos; hay que resolverlos antes de aplicar.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email) WHERE email IS NOT NULL AND email != '';

-- Un mismo usuario no puede enviar dos tickets con la misma referencia de pago.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_tickets_user_reference ON payment_tickets(user_id, reference);
