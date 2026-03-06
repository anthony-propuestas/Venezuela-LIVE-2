/**
 * Motor de renderizado PDF usando pdf-lib.
 * Genera tarjetas tipo screenshot para cada propuesta destacada.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { ReportCard } from './dataLayer';

const CARD_PADDING = 24;
const CARD_MARGIN = 20;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const CARD_WIDTH = PAGE_WIDTH - 2 * CARD_MARGIN;
const FONT_SIZE_TITLE = 14;
const FONT_SIZE_HEADING = 12;
const FONT_SIZE_BODY = 10;
const FONT_SIZE_SMALL = 9;
const LINE_HEIGHT = 1.35;

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const trial = current ? `${current} ${w}` : w;
    if (trial.length > maxChars && current) {
      lines.push(current);
      current = w;
    } else {
      current = trial;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function generateReportPDF(
  cards: ReportCard[],
  _reportTitle: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - CARD_MARGIN;
  const textWidth = CARD_WIDTH - 2 * CARD_PADDING;
  const maxCharsPerLine = Math.floor(textWidth / 5.5);

  for (const card of cards) {
    const descLines = wrapText(card.proposalDescription, maxCharsPerLine);
    const noteLines = card.topCommunityNote
      ? wrapText(truncate(card.topCommunityNote, 350), maxCharsPerLine)
      : [];
    const cardHeight =
      70 +
      Math.min(descLines.length, 5) * FONT_SIZE_BODY * LINE_HEIGHT +
      (noteLines.length > 0 ? 45 + Math.min(noteLines.length, 3) * FONT_SIZE_SMALL * LINE_HEIGHT : 0);

    if (y - cardHeight < CARD_MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - CARD_MARGIN;
    }

    page.drawRectangle({
      x: CARD_MARGIN,
      y: y - cardHeight - 10,
      width: CARD_WIDTH,
      height: cardHeight + 10,
      borderColor: rgb(0.35, 0.4, 0.45),
      borderWidth: 0.8,
    });

    const innerX = CARD_MARGIN + CARD_PADDING;
    let cy = y;

    page.drawText(truncate(card.topicName, 90), {
      x: innerX,
      y: cy - 14,
      size: FONT_SIZE_TITLE,
      font: fontBold,
      color: rgb(0.15, 0.55, 0.8),
    });
    cy -= 22;

    page.drawText(truncate(card.proposalTitle, 90), {
      x: innerX,
      y: cy - 12,
      size: FONT_SIZE_HEADING,
      font: fontBold,
      color: rgb(0.9, 0.9, 0.92),
    });
    cy -= 18;

    page.drawText(`Por ${card.author}`, {
      x: innerX,
      y: cy - 10,
      size: FONT_SIZE_SMALL,
      font: font,
      color: rgb(0.55, 0.55, 0.6),
    });
    cy -= 20;

    for (const line of descLines.slice(0, 5)) {
      page.drawText(truncate(line, 95), {
        x: innerX,
        y: cy - 10,
        size: FONT_SIZE_BODY,
        font: font,
        color: rgb(0.68, 0.68, 0.72),
      });
      cy -= FONT_SIZE_BODY * LINE_HEIGHT;
    }
    cy -= 8;

    const metrics = `👍 ${card.upvotes}  👎 ${card.downvotes}  │  Net: ${card.netScore > 0 ? '+' : ''}${card.netScore}  │  Vol: ${card.volume}`;
    page.drawText(truncate(metrics, 85), {
      x: innerX,
      y: cy - 10,
      size: FONT_SIZE_SMALL,
      font: font,
      color: rgb(0.4, 0.65, 0.55),
    });
    cy -= 18;

    if (card.topCommunityNote) {
      page.drawText('Nota de la comunidad:', {
        x: innerX,
        y: cy - 10,
        size: FONT_SIZE_SMALL,
        font: fontBold,
        color: rgb(0.35, 0.6, 0.82),
      });
      cy -= 14;
      for (const line of noteLines.slice(0, 3)) {
        page.drawText(truncate(line, 95), {
          x: innerX,
          y: cy - 8,
          size: FONT_SIZE_SMALL,
          font: font,
          color: rgb(0.58, 0.62, 0.68),
        });
        cy -= FONT_SIZE_SMALL * LINE_HEIGHT;
      }
      cy -= 6;
    }

    y = cy - CARD_MARGIN;
  }

  return doc.save();
}
