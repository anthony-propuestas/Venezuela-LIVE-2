import { JSDOM } from 'jsdom'
import createDOMPurify from 'dompurify'

const window = new JSDOM('<!doctype html><html><body></body></html>').window
const DOMPurify = createDOMPurify(window)

function assert(condition, message) {
  if (!condition) {
    console.error(`✗ ${message}`)
    process.exitCode = 1
  } else {
    console.log(`✓ ${message}`)
  }
}

// Caso 1: <script> debe ser eliminado
{
  const dirty = '<p>Hola</p><script>alert(1)</script>'
  const clean = DOMPurify.sanitize(dirty)
  assert(!clean.toLowerCase().includes('<script'), 'Elimina etiquetas <script>')
}

// Caso 2: href=\"javascript:...\" debe ser neutralizado
{
  const dirty = '<a href=\"javascript:alert(1)\">Click</a>'
  const clean = DOMPurify.sanitize(dirty)
  assert(!/javascript:/i.test(clean), 'Elimina esquemas javascript: en enlaces')
}

// Caso 3: onerror en <img> debe ser eliminado
{
  const dirty = '<img src=\"x\" onerror=\"alert(1)\">'
  const clean = DOMPurify.sanitize(dirty)
  assert(!/onerror\s*=/.test(clean.toLowerCase()), 'Elimina manejadores de eventos (onerror)')
}

// Si no se ha marcado ningún fallo explícitamente, exitCode será 0
if (process.exitCode === undefined) {
  console.log('Todas las pruebas de sanitización han pasado.')
}

