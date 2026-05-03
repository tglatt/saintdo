import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { readFile } from 'fs/promises';
import { join } from 'path';

// ── Types ─────────────────────────────────────────────────────────────────────

type Seg = { text: string; bold: boolean };

type Block =
  | { type: 'h1'; segs: Seg[] }
  | { type: 'h2'; segs: Seg[] }
  | { type: 'p';  segs: Seg[] }
  | { type: 'li'; segs: Seg[] }
  | { type: 'hr' }
  | { type: 'sig' }
  | { type: 'spacer'; size: number };

// ── Markdown parser ───────────────────────────────────────────────────────────

function parseInline(text: string): Seg[] {
  const parts = text.split('**');
  return parts.filter(p => p !== '').map((p, i) => ({ text: p, bold: i % 2 === 1 }));
}

function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  const rawBlocks = md.split(/\n{2,}/);

  for (const raw of rawBlocks) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    if (trimmed === '---') {
      blocks.push({ type: 'hr' });
      continue;
    }

    if (trimmed === '[SIGNATURE]') {
      blocks.push({ type: 'sig' });
      continue;
    }

    if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'h1', segs: parseInline(trimmed.slice(2)) });
      continue;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'h2', segs: parseInline(trimmed.slice(3)) });
      continue;
    }

    // List block: all lines start with "- "
    const lines = trimmed.split('\n');
    if (lines.every(l => l.trimStart().startsWith('- '))) {
      for (const l of lines) {
        blocks.push({ type: 'li', segs: parseInline(l.trimStart().slice(2)) });
      }
      continue;
    }

    // Regular paragraph (may span multiple lines — join them)
    blocks.push({ type: 'p', segs: parseInline(lines.join(' ')) });
  }

  return blocks;
}

const fmtDate = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

// ── PDF helpers ───────────────────────────────────────────────────────────────

// Replace chars outside WinAnsi (codepoint checks avoid encoding issues)
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

// Draw segments with inline bold support. Returns new y.
function drawSegs(
  ctx: DrawCtx,
  y: number,
  segs: Seg[],
  opts: {
    size?: number;
    indent?: number;
    align?: 'left' | 'center' | 'right';
    spaceAfter?: number;
    defaultBold?: boolean;
  } = {},
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

  // Build wrapped lines
  const lines: Word[][] = [];
  let cur: Word[] = [];
  let curW = 0;
  for (const word of words) {
    const needed = cur.length > 0 ? spaceW + word.w : word.w;
    if (curW + needed > areaW && cur.length > 0) {
      lines.push(cur);
      cur = [word];
      curW = word.w;
    } else {
      cur.push(word);
      curW += needed;
    }
  }
  if (cur.length > 0) lines.push(cur);

  for (const line of lines) {
    if (y - lineH < ctx.marginBottom) y = newPage(ctx);

    // Compute line total width for alignment
    const lineW = line.reduce((s, w, i) => s + (i > 0 ? spaceW : 0) + w.w, 0);
    let x = ctx.marginL + indent;
    if (opts.align === 'center') x = (ctx.pageW - lineW) / 2;
    if (opts.align === 'right')  x = ctx.marginR - lineW;

    for (let i = 0; i < line.length; i++) {
      if (i > 0) x += spaceW;
      const word = line[i];
      currentPage(ctx).drawText(word.text, {
        x, y: y - lineH, font: word.font, size, color: rgb(0.1, 0.1, 0.1),
      });
      x += word.w;
    }
    y -= lineH;
  }

  return y - spaceAfter;
}

// ── Shared data loader ────────────────────────────────────────────────────────

async function loadConventionData(cookies: { get: (name: string) => { value: string } | undefined }) {
  const accessToken = cookies.get('sb-access-token')?.value;
  const refreshToken = cookies.get('sb-refresh-token')?.value;
  if (!accessToken || !refreshToken) return null;

  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  );
  const { data: { user }, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error || !user) return null;

  const admin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: membre } = await admin
    .from('membres')
    .select('id, nom, prenom, address, zip_code, city')
    .eq('email', user.email)
    .single();
  if (!membre) return null;

  const { data: txs } = await admin
    .from('transactions')
    .select('montant, date')
    .eq('membre_id', membre.id)
    .eq('type', 'apport_associatif');

  const totalApport = txs?.reduce((s: number, t: { montant: number }) => s + t.montant, 0) ?? 0;
  const toCC = (s: string) => s.toLowerCase().replace(/(^|\s|-)(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
  const prenom = membre.prenom ? toCC(membre.prenom) : '';
  const nomMaj = membre.nom ? membre.nom.toUpperCase() : '';
  const nom = [prenom, nomMaj].filter(Boolean).join(' ') || (user.email ?? 'Adhérent');
  const montant = totalApport.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  const lastTxDate = txs
    ?.map((t: { date: string | null }) => t.date)
    .filter(Boolean)
    .sort()
    .at(-1);
  const dateApport = lastTxDate ? fmtDate(new Date(lastTxDate)) : '';

  const [mdRaw, sigBuffer] = await Promise.all([
    readFile(join(process.cwd(), 'public', 'Saindo_convention_apport.md'), 'utf-8'),
    readFile(join(process.cwd(), 'public', 'signature.png')),
  ]);

  const adresseParts = [membre.address, membre.zip_code, membre.city].filter(Boolean);
  const adresse = adresseParts.join(' ') || '';

  const md = mdRaw
    .replace('[NOM_ADHERENT]', nom)
    .replace('[ADRESSE_ADHERENT]', adresse)
    .replace('[MONTANT_APPORT]', montant)
    .replace('[DATE_APPORT]', dateApport);

  return { nom, md, sigBuffer, membreId: membre.id };
}

async function buildPdf(
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

  let memberSigImage = memberSigBase64
    ? await doc.embedPng(Buffer.from(memberSigBase64, 'base64'))
    : null;

  const ctx: DrawCtx = {
    doc, pages: [],
    regular, bold,
    marginL: 72, marginR: 523,
    marginTop: 72, marginBottom: 72,
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
        if (memberSigImage) {
          // Two-column layout: adherent left, president right
          const dimsAssoc = sigImage.scaleToFit(160, 62);
          const dimsAdherent = memberSigImage.scaleToFit(110, 42);
          const blockH = Math.max(dimsAssoc.height, dimsAdherent.height) + 30;
          if (y - blockH < ctx.marginBottom) y = newPage(ctx);

          const page = currentPage(ctx);
          const labelSize = 9;
          const nameSize = 9;
          const lineH = labelSize * 1.4;

          // Left column — adherent
          page.drawText(sanitize("L'Adherent :"), {
            x: ctx.marginL, y: y - lineH,
            font: regular, size: labelSize, color: rgb(0.1, 0.1, 0.1),
          });
          page.drawImage(memberSigImage, {
            x: ctx.marginL, y: y - lineH - dimsAdherent.height - 4,
            width: dimsAdherent.width, height: dimsAdherent.height,
          });
          const adherentY = y - lineH - dimsAdherent.height - 4 - nameSize - 4;
          page.drawText(sanitize(nom), {
            x: ctx.marginL, y: adherentY,
            font: bold, size: nameSize, color: rgb(0.1, 0.1, 0.1),
          });

          // Right column — president
          page.drawText(sanitize("Le President :"), {
            x: ctx.marginR - dimsAssoc.width, y: y - lineH,
            font: regular, size: labelSize, color: rgb(0.1, 0.1, 0.1),
          });
          page.drawImage(sigImage, {
            x: ctx.marginR - dimsAssoc.width, y: y - lineH - dimsAssoc.height - 4,
            width: dimsAssoc.width, height: dimsAssoc.height,
          });
          const presidentLineH = nameSize * 1.4;
          const presidentNameY = y - lineH - dimsAssoc.height - 4 - nameSize - 4;
          page.drawText(sanitize('Thomas GLATT'), {
            x: ctx.marginR - dimsAssoc.width, y: presidentNameY,
            font: bold, size: nameSize, color: rgb(0.1, 0.1, 0.1),
          });
          page.drawText(sanitize("President de l'Association"), {
            x: ctx.marginR - dimsAssoc.width, y: presidentNameY - presidentLineH,
            font: regular, size: nameSize, color: rgb(0.1, 0.1, 0.1),
          });

          y -= blockH;
        } else {
          // PDF non signé : signature association à droite + nom/titre
          const dims = sigImage.scaleToFit(300, 115);
          const nameSize = 9;
          const lineH = nameSize * 1.4;
          const blockH = dims.height + lineH * 2 + 8;
          if (y - blockH < ctx.marginBottom) y = newPage(ctx);
          const page = currentPage(ctx);
          page.drawImage(sigImage, {
            x: ctx.marginR - dims.width,
            y: y - dims.height,
            width: dims.width,
            height: dims.height,
          });
          const nameY = y - dims.height - nameSize - 4;
          page.drawText(sanitize('Thomas GLATT'), {
            x: ctx.marginR - dims.width, y: nameY,
            font: bold, size: nameSize, color: rgb(0.1, 0.1, 0.1),
          });
          page.drawText(sanitize("President de l'Association"), {
            x: ctx.marginR - dims.width, y: nameY - lineH,
            font: regular, size: nameSize, color: rgb(0.1, 0.1, 0.1),
          });
          y -= blockH;
        }
        break;
      }
    }
  }

  return doc.save();
}

// ── Routes ────────────────────────────────────────────────────────────────────

function pdfResponse(pdfBytes: Uint8Array, nom: string) {
  const slug = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').toLowerCase();
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="convention-apport-${slug}.pdf"`,
    },
  });
}

export const GET: APIRoute = async ({ cookies, redirect }) => {
  const data = await loadConventionData(cookies);
  if (!data) return redirect('/login');

  // Regénère depuis l'enregistrement signé si disponible
  const admin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: row } = await admin
    .from('conventions')
    .select('contenu_md, signature_adherent')
    .eq('membre_id', data.membreId)
    .order('signed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const md  = row ? row.contenu_md          : data.md;
  const sig = row ? row.signature_adherent  : undefined;
  const pdfBytes = await buildPdf(data.nom, md, data.sigBuffer, sig);
  return pdfResponse(pdfBytes, data.nom);
};

export const POST: APIRoute = async ({ cookies, request }) => {
  const data = await loadConventionData(cookies);
  if (!data) return new Response('Unauthorized', { status: 401 });

  let signature: string | undefined;
  try {
    const body = await request.json();
    signature = body.signature;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }
  if (!signature) return new Response('Missing signature', { status: 400 });

  // Enregistre en base
  const admin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  await admin.from('conventions').insert({
    membre_id:           data.membreId,
    signed_at:           new Date().toISOString(),
    contenu_md:          data.md,
    signature_adherent:  signature,
  });

  const pdfBytes = await buildPdf(data.nom, data.md, data.sigBuffer, signature);
  return pdfResponse(pdfBytes, data.nom);
};
