import React, { useMemo } from 'react'
import { sanitizeHtml } from '@client/utils/sanitize'

/**
 * Componente de alto nivel para renderizar HTML ya sanitizado.
 *
 * Uso recomendado:
 *   <SafeHtml html={htmlPeligrosoOPotencialmenteRico} className="..." as="div" />
 *
 * En toda la app, cualquier `dangerouslySetInnerHTML` debe pasar por aquí.
 */
export function SafeHtml({ html, as: Tag = 'div', className }) {
  const clean = useMemo(() => sanitizeHtml(html), [html])

  return (
    <Tag
      className={className}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}

