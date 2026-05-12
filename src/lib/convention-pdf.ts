import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Seg = { text: string; bold: boolean };

export type Block =
  | { type: 'h1'; segs: Seg[] }
  | { type: 'h2'; segs: Seg[] }
  | { type: 'p';  segs: Seg[] }
  | { type: 'li'; segs: Seg[] }
  | { type: 'hr' }
  | { type: 'sig' }
  | { type: 'spacer'; size: number };

// ── Markdown parser ───────────────────────────────────────────────────────────

export function parseInline(text: string): Seg[] {
  const parts = text.split('**');
  return parts.filter(p => p !== '').map((p, i) => ({ text: p, bold: i % 2 === 1 }));
}

export function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of md.split(/\n{2,}/)) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed === '---') { blocks.push({ type: 'hr' }); continue; }
    if (trimmed === '[SIGNATURE]') { blocks.push({ type: 'sig' }); continue; }
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

// ── Helpers ───────────────────────────────────────────────────────────────────

export const fmtDate = (d: Date) =>
  d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

export function sanitize(text: string): string {
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

// ── PDF draw context ──────────────────────────────────────────────────────────

type DrawCtx = {
  doc: PDFDocument;
  pages: PDFPage[];
  regular: PDFFont;
  bold: PDFFont;
  marginL: number;
  marginR: number;
  marginTop: number;
  marginBottom: number;
  pageW: number;
  pageH: number;
};

function currentPage(ctx: DrawCtx) { return ctx.pages[ctx.pages.length - 1]; }

function newPage(ctx: DrawCtx): number {
  const page = ctx.doc.addPage([ctx.pageW, ctx.pageH]);
  ctx.pages.push(page);
  return ctx.pageH - ctx.marginTop;
}

function drawSegs(
  ctx: DrawCtx,
  y: number,
  segs: Seg[],
  opts: { size?: number; indent?: number; align?: 'left' | 'center' | 'right'; spaceAfter?: number; defaultBold?: boolean } = {},
): number {
  const size = opts.size ?? 12;
  const indent = opts.indent ?? 0;
  const spaceAfter = opts.spaceAfter ?? 8;
  const lineH = size * 1.5;
  const areaW = ctx.marginR - ctx.marginL - indent;
  const spaceW = ctx.regular.widthOfTextAtSize(' ', size);

  type Word = { text: string; font: PDFFont; w: number };
  const words: Word[] = [];
  for (const seg of segs) {
    const font = (opts.defaultBold || seg.bold) ? ctx.bold : ctx.regular;
    for (const w of sanitize(seg.text).split(' ')) {
      if (!w) continue;
      words.push({ text: w, font, w: font.widthOfTextAtSize(w, size) });
    }
  }

  const lines: Word[][] = [];
  let cur: Word[] = [];
  let curW = 0;
  for (const word of words) {
    const needed = cur.length > 0 ? spaceW + word.w : word.w;
    if (curW + needed > areaW && cur.length > 0) { lines.push(cur); cur = [word]; curW = word.w; }
    else { cur.push(word); curW += needed; }
  }
  if (cur.length > 0) lines.push(cur);

  for (const line of lines) {
    if (y - lineH < ctx.marginBottom) y = newPage(ctx);
    const lineW = line.reduce((s, w, i) => s + (i > 0 ? spaceW : 0) + w.w, 0);
    let x = ctx.marginL + indent;
    if (opts.align === 'center') x = (ctx.pageW - lineW) / 2;
    if (opts.align === 'right')  x = ctx.marginR - lineW;
    for (let i = 0; i < line.length; i++) {
      if (i > 0) x += spaceW;
      const word = line[i];
      currentPage(ctx).drawText(word.text, { x, y: y - lineH, font: word.font, size, color: rgb(0.1, 0.1, 0.1) });
      x += word.w;
    }
    y -= lineH;
  }
  return y - spaceAfter;
}

// ── PDF builder ───────────────────────────────────────────────────────────────

export async function buildPdf(
  nom: string,
  md: string,
  sigBuffer: Buffer,
  memberSigBase64?: string,
): Promise<Uint8Array> {
  const blocks = parseMarkdown(md);
  const dateJour = fmtDate(new Date());
  blocks.push({ type: 'spacer', size: 30 });
  blocks.push({ type: 'p', segs: [{ text: `Fait à Die, le ${dateJour}`, bold: false }] });
  blocks.push({ type: 'hr' });
  blocks.push({ type: 'sig' });

  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold    = await doc.embedFont(StandardFonts.HelveticaBold);
  const sigImage = await doc.embedPng(sigBuffer);
  const memberSigImage = memberSigBase64
    ? await doc.embedPng(Buffer.from(memberSigBase64, 'base64'))
    : null;

  const ctx: DrawCtx = {
    doc, pages: [], regular, bold,
    marginL: 72, marginR: 523, marginTop: 72, marginBottom: 72,
    pageW: 595, pageH: 842,
  };
  let y = newPage(ctx);
  let rightAlign = false;

  for (const block of blocks) {
    switch (block.type) {
      case 'h1':
        y = drawSegs(ctx, y, block.segs, { size: 16, align: 'center', defaultBold: true, spaceAfter: 20 });
        break;
      case 'h2':
        y = drawSegs(ctx, y, block.segs, { size: 13, defaultBold: true, spaceAfter: 10 });
        break;
      case 'p':
        y = drawSegs(ctx, y, block.segs, { align: rightAlign ? 'right' : 'left', spaceAfter: 10 });
        break;
      case 'li':
        y = drawSegs(ctx, y, [{ text: '- ', bold: false }, ...block.segs], { indent: 16, spaceAfter: 6 });
        break;
      case 'spacer':
        y -= block.size;
        break;
      case 'hr':
        y -= 16;
        rightAlign = true;
        break;
      case 'sig': {
        const labelSize = 9;
        const nameSize = 9;
        const lineH = labelSize * 1.4;

        if (memberSigImage) {
          const dimsAssoc    = sigImage.scaleToFit(160, 62);
          const dimsAdherent = memberSigImage.scaleToFit(110, 42);
          const blockH = Math.max(dimsAssoc.height, dimsAdherent.height) + 30;
          if (y - blockH < ctx.marginBottom) y = newPage(ctx);
          const page = currentPage(ctx);

          page.drawText(sanitize("L'Adherent :"), { x: ctx.marginL, y: y - lineH, font: regular, size: labelSize, color: rgb(0.1, 0.1, 0.1) });
          page.drawImage(memberSigImage, { x: ctx.marginL, y: y - lineH - dimsAdherent.height - 4, width: dimsAdherent.width, height: dimsAdherent.height });
          page.drawText(sanitize(nom), { x: ctx.marginL, y: y - lineH - dimsAdherent.height - 4 - nameSize - 4, font: bold, size: nameSize, color: rgb(0.1, 0.1, 0.1) });

          page.drawText(sanitize("Le President :"), { x: ctx.marginR - dimsAssoc.width, y: y - lineH, font: regular, size: labelSize, color: rgb(0.1, 0.1, 0.1) });
          page.drawImage(sigImage, { x: ctx.marginR - dimsAssoc.width, y: y - lineH - dimsAssoc.height - 4, width: dimsAssoc.width, height: dimsAssoc.height });
          const presidentNameY = y - lineH - dimsAssoc.height - 4 - nameSize - 4;
          page.drawText(sanitize('Thomas GLATT'), { x: ctx.marginR - dimsAssoc.width, y: presidentNameY, font: bold, size: nameSize, color: rgb(0.1, 0.1, 0.1) });
          page.drawText(sanitize("President de l'Association"), { x: ctx.marginR - dimsAssoc.width, y: presidentNameY - nameSize * 1.4, font: regular, size: nameSize, color: rgb(0.1, 0.1, 0.1) });

          y -= blockH;
        } else {
          const dims = sigImage.scaleToFit(300, 115);
          const blockH = dims.height + lineH * 2 + 8;
          if (y - blockH < ctx.marginBottom) y = newPage(ctx);
          const page = currentPage(ctx);
          page.drawImage(sigImage, { x: ctx.marginR - dims.width, y: y - dims.height, width: dims.width, height: dims.height });
          const nameY = y - dims.height - nameSize - 4;
          page.drawText(sanitize('Thomas GLATT'), { x: ctx.marginR - dims.width, y: nameY, font: bold, size: nameSize, color: rgb(0.1, 0.1, 0.1) });
          page.drawText(sanitize("President de l'Association"), { x: ctx.marginR - dims.width, y: nameY - lineH, font: regular, size: nameSize, color: rgb(0.1, 0.1, 0.1) });
          y -= blockH;
        }
        break;
      }
    }
  }

  return doc.save();
}

// ── Pouvoir PDF ───────────────────────────────────────────────────────────────

export async function buildPouvoirPdf(
  nomAdherent: string,
  nomPouvoir: string,
  memberSigBase64: string,
  mdTemplate: string,
): Promise<Uint8Array> {
  const dateJour = fmtDate(new Date());
  const md = mdTemplate
    .replace('[NOM_ADHERENT]', nomAdherent)
    .replace('[NOM_POUVOIR]', nomPouvoir)
    .replace('[DATE_JOUR]', dateJour);

  const blocks = parseMarkdown(md);
  blocks.push({ type: 'spacer', size: 20 });
  blocks.push({ type: 'hr' });
  blocks.push({ type: 'sig' });

  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold    = await doc.embedFont(StandardFonts.HelveticaBold);
  const memberSigImage = await doc.embedPng(Buffer.from(memberSigBase64, 'base64'));

  const ctx: DrawCtx = {
    doc, pages: [], regular, bold,
    marginL: 72, marginR: 523, marginTop: 72, marginBottom: 72,
    pageW: 595, pageH: 842,
  };
  let y = newPage(ctx);

  for (const block of blocks) {
    switch (block.type) {
      case 'h1':
        y = drawSegs(ctx, y, block.segs, { size: 16, align: 'center', defaultBold: true, spaceAfter: 20 });
        break;
      case 'h2':
        y = drawSegs(ctx, y, block.segs, { size: 13, defaultBold: true, spaceAfter: 10 });
        break;
      case 'p':
        y = drawSegs(ctx, y, block.segs, { spaceAfter: 10 });
        break;
      case 'li':
        y = drawSegs(ctx, y, [{ text: '- ', bold: false }, ...block.segs], { indent: 16, spaceAfter: 6 });
        break;
      case 'spacer':
        y -= block.size;
        break;
      case 'hr':
        y -= 16;
        break;
      case 'sig': {
        const nameSize = 9;
        const labelSize = 9;
        const lineH = labelSize * 1.4;
        const dims = memberSigImage.scaleToFit(160, 62);
        const blockH = dims.height + lineH + nameSize + 16;
        if (y - blockH < ctx.marginBottom) y = newPage(ctx);
        const page = currentPage(ctx);
        page.drawText(sanitize('Signature :'), {
          x: ctx.marginL, y: y - lineH,
          font: regular, size: labelSize, color: rgb(0.1, 0.1, 0.1),
        });
        page.drawImage(memberSigImage, {
          x: ctx.marginL, y: y - lineH - dims.height - 4,
          width: dims.width, height: dims.height,
        });
        page.drawText(sanitize(nomAdherent), {
          x: ctx.marginL, y: y - lineH - dims.height - 4 - nameSize - 4,
          font: bold, size: nameSize, color: rgb(0.1, 0.1, 0.1),
        });
        y -= blockH;
        break;
      }
    }
  }

  return doc.save();
}

// ── Response helpers ──────────────────────────────────────────────────────────

function slugify(nom: string) {
  return nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').toLowerCase();
}

export function pdfResponse(pdfBytes: Uint8Array, nom: string): Response {
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="convention-apport-${slugify(nom)}.pdf"`,
    },
  });
}

export function pouvoirPdfResponse(pdfBytes: Uint8Array, nom: string): Response {
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="pouvoir-age-${slugify(nom)}.pdf"`,
    },
  });
}
