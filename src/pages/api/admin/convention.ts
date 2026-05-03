import type { APIRoute } from 'astro';
import { createAdminClient } from '../../../lib/supabase';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Re-uses the same PDF building logic as /api/convention.ts

type Seg = { text: string; bold: boolean };
type Block =
  | { type: 'h1'; segs: Seg[] }
  | { type: 'h2'; segs: Seg[] }
  | { type: 'p';  segs: Seg[] }
  | { type: 'li'; segs: Seg[] }
  | { type: 'hr' }
  | { type: 'sig' }
  | { type: 'spacer'; size: number };

function parseInline(text: string): Seg[] {
  const parts = text.split('**');
  return parts.filter(p => p !== '').map((p, i) => ({ text: p, bold: i % 2 === 1 }));
}

function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of md.split(/\n{2,}/)) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed === '---') { blocks.push({ type: 'hr' }); continue; }
    if (trimmed.startsWith('# '))  { blocks.push({ type: 'h1', segs: parseInline(trimmed.slice(2)) }); continue; }
    if (trimmed.startsWith('## ')) { blocks.push({ type: 'h2', segs: parseInline(trimmed.slice(3)) }); continue; }
    const lines = trimmed.split('\n');
    if (lines.every(l => l.trimStart().startsWith('- '))) {
      for (const l of lines) blocks.push({ type: 'li', segs: parseInline(l.trimStart().slice(2)) });
      continue;
    }
    blocks.push({ type: 'p', segs: parseInline(lines.join(' ')) });
  }
  return blocks;
}

const fmtDate = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

function sanitize(text: string): string {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0x202F || cp === 0x00A0) { out += ' '; continue; }
    if (cp === 0x2018 || cp === 0x2019) { out += "'"; continue; }
    if (cp === 0x2013 || cp === 0x2014) { out += '-'; continue; }
    out += ch;
  }
  return out;
}

type DrawCtx = { doc: PDFDocument; pages: PDFPage[]; regular: PDFFont; bold: PDFFont; marginL: number; marginR: number; marginTop: number; marginBottom: number; pageW: number; pageH: number };
const currentPage = (ctx: DrawCtx) => ctx.pages[ctx.pages.length - 1];
function newPage(ctx: DrawCtx) { const p = ctx.doc.addPage([ctx.pageW, ctx.pageH]); ctx.pages.push(p); return ctx.pageH - ctx.marginTop; }

function drawSegs(ctx: DrawCtx, y: number, segs: Seg[], opts: { size?: number; indent?: number; align?: 'left'|'center'|'right'; spaceAfter?: number; defaultBold?: boolean } = {}): number {
  const size = opts.size ?? 12; const indent = opts.indent ?? 0; const spaceAfter = opts.spaceAfter ?? 8; const lineH = size * 1.5;
  const areaW = ctx.marginR - ctx.marginL - indent; const spaceW = ctx.regular.widthOfTextAtSize(' ', size);
  type Word = { text: string; font: PDFFont; w: number };
  const words: Word[] = [];
  for (const seg of segs) { const font = (opts.defaultBold || seg.bold) ? ctx.bold : ctx.regular; for (const w of sanitize(seg.text).split(' ')) { if (!w) continue; words.push({ text: w, font, w: font.widthOfTextAtSize(w, size) }); } }
  const lines: Word[][] = []; let cur: Word[] = []; let curW = 0;
  for (const word of words) { const needed = cur.length > 0 ? spaceW + word.w : word.w; if (curW + needed > areaW && cur.length > 0) { lines.push(cur); cur = [word]; curW = word.w; } else { cur.push(word); curW += needed; } }
  if (cur.length > 0) lines.push(cur);
  for (const line of lines) {
    if (y - lineH < ctx.marginBottom) y = newPage(ctx);
    const lineW = line.reduce((s, w, i) => s + (i > 0 ? spaceW : 0) + w.w, 0);
    let x = ctx.marginL + indent;
    if (opts.align === 'center') x = (ctx.pageW - lineW) / 2;
    if (opts.align === 'right')  x = ctx.marginR - lineW;
    for (let i = 0; i < line.length; i++) { if (i > 0) x += spaceW; const word = line[i]; currentPage(ctx).drawText(word.text, { x, y: y - lineH, font: word.font, size, color: rgb(0.1, 0.1, 0.1) }); x += word.w; }
    y -= lineH;
  }
  return y - spaceAfter;
}

export const GET: APIRoute = async ({ url }) => {
  const membreId = url.searchParams.get('membre_id');
  if (!membreId) return new Response('Missing membre_id', { status: 400 });

  const supabase = createAdminClient();

  const { data: membre } = await supabase
    .from('membres')
    .select('id, nom, prenom')
    .eq('id', membreId)
    .single();
  if (!membre) return new Response('Not found', { status: 404 });

  const { data: row } = await supabase
    .from('conventions')
    .select('contenu_md, signature_adherent')
    .eq('membre_id', membreId)
    .order('signed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) return new Response('Aucune convention signée', { status: 404 });

  const toCC = (s: string) => s.toLowerCase().replace(/(^|\s|-)(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
  const prenom = membre.prenom ? toCC(membre.prenom) : '';
  const nomMaj = membre.nom ? membre.nom.toUpperCase() : '';
  const nom = [prenom, nomMaj].filter(Boolean).join(' ') || 'Adhérent';

  const sigBuffer = await readFile(join(process.cwd(), 'public', 'signature.png'));
  const blocks = parseMarkdown(row.contenu_md);
  const dateJour = fmtDate(new Date());
  blocks.push({ type: 'spacer', size: 30 });
  blocks.push({ type: 'p', segs: [{ text: `Fait à Die, le ${dateJour}`, bold: false }] });
  blocks.push({ type: 'hr' });
  blocks.push({ type: 'sig' });

  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold    = await doc.embedFont(StandardFonts.HelveticaBold);
  const sigImage = await doc.embedPng(sigBuffer);
  const memberSigImage = await doc.embedPng(Buffer.from(row.signature_adherent, 'base64'));

  const ctx: DrawCtx = { doc, pages: [], regular, bold, marginL: 72, marginR: 523, marginTop: 72, marginBottom: 72, pageW: 595, pageH: 842 };
  let y = newPage(ctx);
  let rightAlign = false;

  for (const block of blocks) {
    switch (block.type) {
      case 'h1': y = drawSegs(ctx, y, block.segs, { size: 16, align: 'center', defaultBold: true, spaceAfter: 20 }); break;
      case 'h2': y = drawSegs(ctx, y, block.segs, { size: 13, defaultBold: true, spaceAfter: 10 }); break;
      case 'p':  y = drawSegs(ctx, y, block.segs, { align: rightAlign ? 'right' : 'left', spaceAfter: 10 }); break;
      case 'li': y = drawSegs(ctx, y, [{ text: '- ', bold: false }, ...block.segs], { indent: 16, spaceAfter: 6 }); break;
      case 'spacer': y -= block.size; break;
      case 'hr': y -= 16; rightAlign = true; break;
      case 'sig': {
        const dimsAssoc = sigImage.scaleToFit(160, 62);
        const dimsAdherent = memberSigImage.scaleToFit(110, 42);
        const blockH = Math.max(dimsAssoc.height, dimsAdherent.height) + 30;
        if (y - blockH < ctx.marginBottom) y = newPage(ctx);
        const page = currentPage(ctx);
        const labelSize = 9; const nameSize = 9; const lineH = labelSize * 1.4;
        page.drawText(sanitize("L'Adherent :"), { x: ctx.marginL, y: y - lineH, font: regular, size: labelSize, color: rgb(0.1, 0.1, 0.1) });
        page.drawImage(memberSigImage, { x: ctx.marginL, y: y - lineH - dimsAdherent.height - 4, width: dimsAdherent.width, height: dimsAdherent.height });
        page.drawText(sanitize(nom), { x: ctx.marginL, y: y - lineH - dimsAdherent.height - 4 - nameSize - 4, font: bold, size: nameSize, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(sanitize("Le President :"), { x: ctx.marginR - dimsAssoc.width, y: y - lineH, font: regular, size: labelSize, color: rgb(0.1, 0.1, 0.1) });
        page.drawImage(sigImage, { x: ctx.marginR - dimsAssoc.width, y: y - lineH - dimsAssoc.height - 4, width: dimsAssoc.width, height: dimsAssoc.height });
        const presidentNameY = y - lineH - dimsAssoc.height - 4 - nameSize - 4;
        page.drawText(sanitize('Thomas GLATT'), { x: ctx.marginR - dimsAssoc.width, y: presidentNameY, font: bold, size: nameSize, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(sanitize("President de l'Association"), { x: ctx.marginR - dimsAssoc.width, y: presidentNameY - nameSize * 1.4, font: regular, size: nameSize, color: rgb(0.1, 0.1, 0.1) });
        y -= blockH;
        break;
      }
    }
  }

  const pdfBytes = await doc.save();
  const slug = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').toLowerCase();
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="convention-apport-${slug}.pdf"`,
    },
  });
};
