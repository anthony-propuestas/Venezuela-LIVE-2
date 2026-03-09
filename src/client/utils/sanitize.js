import DOMPurify from 'dompurify'

// Configuración estricta para sanitizar HTML antes de inyectarlo en el DOM.
// Centralizamos aquí todas las reglas para poder auditarlas y ajustarlas.
const STRICT_CONFIG = {
  // Refuerza que no se procesen etiquetas activas o de incrustación insegura.
  FORBID_TAGS: [
    'script',
    'style',
    'iframe',
    'object',
    'embed',
    'form',
    'input',
    'button',
    'link',
    'meta',
  ],
}

/**
 * Sanitiza una cadena potencialmente peligrosa para uso como HTML.
 * Siempre debe ser el único punto desde donde se usa DOMPurify en el cliente.
 *
 * @param {string} dirty - Cadena con posible HTML (p. ej. rich text de usuario).
 * @returns {string} HTML seguro para pasar a dangerouslySetInnerHTML.
 */
export function sanitizeHtml(dirty) {
  if (!dirty) return ''

  const value = String(dirty)

  // DOMPurify ya protege contra `javascript:` y manejadores de eventos;
  // STRICT_CONFIG refuerza la eliminación de etiquetas de alto riesgo.
  return DOMPurify.sanitize(value, STRICT_CONFIG)
}

