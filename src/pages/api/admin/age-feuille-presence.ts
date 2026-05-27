import type { APIRoute } from 'astro';
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import { createAdminClient } from '../../../lib/supabase';
import { sanitize } from '../../../lib/convention-pdf';

const COL_X    = [36, 61, 226, 316, 436];
const COL_W    = [25, 165, 90, 120, 123];
const PAGE_W   = 595;
const PAGE_H   = 842;
const MARGIN_TOP = 72;
const MARGIN_BOT = 50;
const ROW_H    = 28;
const HEADER_H = 30;
const HEADERS   = ['N°', 'Nom  Prénom', 'Date adhésion', 'Pouvoir', 'Signature'];

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'Europe/Paris',
  });
}

function drawCell(
  page: PDFPage,
  text: string,
  x: number, y: number, w: number, h: number,
  font: PDFFont, size: number,
  isHeader = false,
) {
  page.drawRectangle({
    x, y, width: w, height: h,
    borderColor: rgb(0.6, 0.6, 0.6),
    borderWidth: 0.5,
    color: isHeader ? rgb(0.93, 0.93, 0.93) : rgb(1, 1, 1),
  });
  if (!text) return;
  const pad = 5;
  let display = sanitize(text);
  while (display.length > 0 && font.widthOfTextAtSize(display, size) > w - pad * 2) {
    display = display.slice(0, -1);
  }
  page.drawText(display, {
    x: x + pad, y: y + (h - size) / 2 - 1,
    font, size,
    color: isHeader ? rgb(0.2, 0.2, 0.2) : rgb(0.1, 0.1, 0.1),
  });
}

function drawHeader(page: PDFPage, y: number, bold: PDFFont) {
  for (let i = 0; i < HEADERS.length; i++) {
    drawCell(page, HEADERS[i], COL_X[i], y - HEADER_H, COL_W[i], HEADER_H, bold, 8, true);
  }
  return y - HEADER_H;
}

export const GET: APIRoute = async () => {
  const supabase = createAdminClient();

  const [{ data: membres }, { data: reponses }, { data: transactions }] = await Promise.all([
    supabase.from('membres').select('id, nom, prenom').order('nom', { ascending: true }),
    supabase.from('age_reponses').select('membre_id, pouvoir_a, presence'),
    supabase.from('transactions').select('membre_id, date').eq('type', 'adhesion').order('date', { ascending: true }),
  ]);

  const pouvoirMap = new Map<string, string>();
  for (const r of reponses ?? []) {
    if (r.membre_id && !r.presence && r.pouvoir_a) pouvoirMap.set(r.membre_id, r.pouvoir_a);
  }

  const adhesionMap = new Map<string, string>();
  for (const t of transactions ?? []) {
    if (t.membre_id && !adhesionMap.has(t.membre_id)) adhesionMap.set(t.membre_id, t.date);
  }

  const rows = (membres ?? []).map((m, i) => ({
    num:      String(i + 1),
    nomPrenom: `${m.nom ? m.nom.toUpperCase() : '—'} ${m.prenom ?? '—'}`,
    adhesion:  adhesionMap.has(m.id) ? fmtDateShort(adhesionMap.get(m.id)!) : '—',
    pouvoir:   pouvoirMap.get(m.id) ?? '',
  }));

  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold    = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN_TOP;

  const dateEdition = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Paris',
  });
  page.drawText(sanitize('Feuille de présence — Assemblée Générale'), {
    x: 36, y,
    font: bold, size: 14, color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText(sanitize(`Éditée le ${dateEdition} — ${rows.length} membre${rows.length > 1 ? 's' : ''}`), {
    x: 36, y: y - 18,
    font: regular, size: 9, color: rgb(0.5, 0.5, 0.5),
  });
  y -= 44;

  y = drawHeader(page, y, bold);

  for (const row of rows) {
    if (y - ROW_H < MARGIN_BOT) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN_TOP;
      y = drawHeader(page, y, bold);
    }
    drawCell(page, row.num,       COL_X[0], y - ROW_H, COL_W[0], ROW_H, regular, 7);
    drawCell(page, row.nomPrenom, COL_X[1], y - ROW_H, COL_W[1], ROW_H, bold, 8);
    drawCell(page, row.adhesion,  COL_X[2], y - ROW_H, COL_W[2], ROW_H, regular, 8);
    drawCell(page, row.pouvoir,   COL_X[3], y - ROW_H, COL_W[3], ROW_H, regular, 8);
    drawCell(page, '',            COL_X[4], y - ROW_H, COL_W[4], ROW_H, regular, 8);
    y -= ROW_H;
  }

  const pdfBytes = await doc.save();

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="feuille-presence-age.pdf"',
    },
  });
};
