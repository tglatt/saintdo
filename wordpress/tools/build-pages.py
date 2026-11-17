#!/usr/bin/env python3
"""Génère, à partir des pages Astro, les gabarits du plugin WordPress (menu,
contact, pied de page, CSS/JS globaux) et le contenu des pages publiques
(JSON prêt pour l'API REST). Usage : build-pages.py <dossier_sortie_pages> <faq.html>"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
PLUGIN = ROOT / 'wordpress' / 'saindo-site'
OUT = pathlib.Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
FAQ_HTML = pathlib.Path(sys.argv[2]).read_text() if len(sys.argv) > 2 else ''

CTA = {
    'ctaAdhesion': 'https://www.helloasso.com/associations/le-saint-domingue/adhesions/adhesion',
    'ctaDon': 'https://www.helloasso.com/associations/graine-de-moutarde-fonds-de-dotation/collectes/rehabilitation-de-l-hotel-saint-domingue',
    'ctaApport': 'https://www.helloasso.com/associations/le-saint-domingue/boutiques/apports-associatifs',
}
MEDIA = {
    '/hotel.jpg': 'https://saindo.org/wp-content/uploads/2026/11/hotel-scaled.jpg',
    '/schema-scic.jpg': 'https://saindo.org/wp-content/uploads/2026/11/schema-scic-scaled.jpg',
    '/team/camille.png': 'https://saindo.org/wp-content/uploads/2026/11/camille.png',
    '/team/eric.png': 'https://saindo.org/wp-content/uploads/2026/11/eric.png',
    '/team/erwan.png': 'https://saindo.org/wp-content/uploads/2026/11/erwan.png',
    '/team/thomas.png': 'https://saindo.org/wp-content/uploads/2026/11/thomas.png',
    '/team/helene.png': 'https://saindo.org/wp-content/uploads/2026/11/helene.png',
    '/team/spyros.png': 'https://saindo.org/wp-content/uploads/2026/11/spyros.png',
    '/team/jb.png': 'https://saindo.org/wp-content/uploads/2026/11/jb.png',
    '/team/florentin.png': 'https://saindo.org/wp-content/uploads/2026/11/florentin.png',
    '/team/fanny.png': 'https://saindo.org/wp-content/uploads/2026/11/fanny.png',
    '/projet/plan-rdc.png': 'https://saindo.org/wp-content/uploads/2026/11/plan-rdc.png',
    '/projet/plan-etage-1.png': 'https://saindo.org/wp-content/uploads/2026/11/plan-etage-1.png',
    '/projet/plan-etage-2.png': 'https://saindo.org/wp-content/uploads/2026/11/plan-etage-2.png',
    '/projet/plan-etage-3.png': 'https://saindo.org/wp-content/uploads/2026/11/plan-etage-3.png',
}
ROOT_VARS = """:root {
  --green: #6663A0; --green-dark: #2D2A68; --green-light: #B0ADD4;
  --amber: #A07C10; --amber-dark: #7A5E0A;
  --bg: #F7F6FB; --bg-alt: #EEEDF6; --text: #1C1C1E; --text-muted: #5C5C6B;
  --white: #FFFFFF; --radius: 12px; --shadow: 0 4px 24px rgba(0,0,0,0.08);
}"""

def read(rel): return (ROOT / rel).read_text()
def block(src, tag):
    m = re.search(rf'<{tag}>(.*?)</{tag}>', src, re.S)
    return m.group(1) if m else ''
def dedent(s): return '\n'.join(l[2:] if l.startswith('  ') else l for l in s.strip('\n').splitlines())

# ---- CSS : préfixe chaque sélecteur, en respectant @media ; supprime les règles globales
DROP = {'*, *::before, *::after', 'html', 'body', ':root'}
def prefix_css(css, prefix, rename=None):
    rename = rename or {}
    css = re.sub(r':global\(([^)]*)\)', r'\1', css)
    res = ''; i = 0
    while i < len(css):
        if css.startswith('/*', i):
            j = css.index('*/', i) + 2; res += css[i:j]; i = j; continue
        jo = css.find('{', i); jc = css.find('}', i)
        if jo == -1 or (jc != -1 and jc < jo):
            if jc == -1: res += css[i:]; break
            res += css[i:jc + 1]; i = jc + 1; continue
        sel = css[i:jo]; depth = 1; k = jo + 1
        while depth:
            depth += {'{': 1, '}': -1}.get(css[k], 0); k += 1
        body = css[jo + 1:k - 1]
        for c in re.findall(r'/\*.*?\*/', sel, re.S): res += c + '\n'
        sel = re.sub(r'/\*.*?\*/', '', sel, flags=re.S); s = sel.strip()
        if s in DROP: pass
        elif s.startswith(('@media', '@supports')): res += sel + '{' + prefix_css(body, prefix, rename) + '}'
        elif s.startswith('@'): res += sel + '{' + body + '}'
        else:
            lead = sel[:len(sel) - len(sel.lstrip())]
            parts = []
            for x in s.split(','):
                x = x.strip(); x = rename.get(x, x)
                parts.append(x if x.startswith('.saindo-') else f'{prefix} {x}')
            res += lead + ', '.join(parts) + ' {' + body + '}'
        i = k
    return res

def strip_comments(html): return re.sub(r'<!--.*?-->', '', html, flags=re.S)
def fix_links(html):
    for k, v in CTA.items(): html = html.replace('{' + k + '}', f'"{v}"')
    for k, v in MEDIA.items(): html = html.replace(f'src="{k}"', f'src="{v}"')
    return html
def js(src):  # TypeScript léger → JS
    src = re.sub(r'\)!', ')', src); src = re.sub(r' as [A-Za-z]+', '', src)
    src = re.sub(r'<[A-Za-z]+>\(', '(', src); src = re.sub(r'(\w+): (HTMLImageElement|number|string)\b', r'\1', src)
    return dedent(src)

# ---- Plugin : nav, contact, footer, css/js globaux
nav_src = read('src/components/Nav.astro')
nav_html = nav_src[nav_src.index('<nav>'):nav_src.index('<style>')].strip()
nav_html = nav_html.replace('<nav>', '<nav class="saindo-nav">').replace('<div class="mobile-menu"', '<div class="saindo-mobile-menu"')
nav_html = re.sub(r'class=\{`(nav-link|mobile-link) \$\{activePage === \'([a-z-]+)\' \? \'[a-z-]+--active\' : \'\'\}`\}',
                  r'class="\1 <?= $active === \'\2\' ? \'\1--active\' : \'\' ?>"', nav_html)
nav_html = nav_html.replace('href="/" class="brand"', 'href="<?= esc_url(home_url(\'/\')) ?>" class="brand"')
nav_html = nav_html.replace('href="/#contact"', 'href="<?= esc_url(home_url(\'/#contact\')) ?>"')
nav_html = nav_html.replace('href="/login"', 'href="<?= esc_url(saindo_app_url() . \'/login\') ?>"')
for slug in ('je-contribue', 'j-ai-un-projet', 'faq', 'qui-sommes-nous'):
    nav_html = nav_html.replace(f'href="/{slug}"', f'href="<?= esc_url(home_url(\'/{slug}/\')) ?>"')
nav_html = nav_html.replace("\\'", "'")
(PLUGIN / 'templates' / 'nav.php').write_text(
    "<?php\n/** @var string $active  slug de la page courante */\nif (!defined('ABSPATH')) exit;\n?>\n" + nav_html + '\n')

contact_src = read('src/components/ContactSection.astro')
contact_html = contact_src[:contact_src.index('<style>')].strip().replace('<section id="contact" class="section section-contact">', '<section id="contact" class="saindo-contact section section-contact">')
(PLUGIN / 'templates' / 'contact.php').write_text("<?php if (!defined('ABSPATH')) exit; ?>\n" + contact_html + '\n')

footer_html = """<footer class="saindo-footer">
  <div class="footer-inner">
    <div>
      <strong>Hôtel Saint Domingue</strong>
      <span>44 rue Camille Buffardel, Die (26)</span>
    </div>
    <div class="newsletter" id="saindo-newsletter">
      <strong>Restez informé</strong>
      <form data-saindo-newsletter>
        <input type="email" name="email" placeholder="votre@email.fr" required />
        <button type="submit">S'inscrire</button>
      </form>
      <p class="saindo-newsletter-msg" aria-live="polite"></p>
    </div>
    <div>
      <a href="<?= esc_url(home_url('/')) ?>">saindo.org</a>
    </div>
  </div>
</footer>"""
(PLUGIN / 'templates' / 'footer.php').write_text("<?php if (!defined('ABSPATH')) exit; ?>\n" + footer_html + '\n')

site_css = "/* Styles globaux du site vitrine — générés par wordpress/tools/build-pages.py depuis les composants Astro. */\n"
site_css += "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;500;600&display=swap');\n\n"
site_css += ROOT_VARS + "\n"
site_css += "html { scroll-behavior: smooth; }\n"
site_css += "body { font-family: 'Inter', system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.65; margin: 0; }\n"
site_css += ".saindo-page, .saindo-page *, .saindo-page *::before, .saindo-page *::after,\n.saindo-nav, .saindo-nav *, .saindo-contact, .saindo-contact *, .saindo-footer, .saindo-footer *,\n.saindo-mobile-menu, .saindo-mobile-menu * { box-sizing: border-box; margin: 0; padding: 0; }\n"
site_css += ".saindo-page a, .saindo-nav a, .saindo-footer a, .saindo-contact a { text-decoration: none; }\n"
site_css += ".saindo-page img { max-width: 100%; height: auto; }\n\n"
site_css += "/* --- Navigation --- */\n" + prefix_css(dedent(block(nav_src, 'style')), '.saindo-nav', {'nav': '.saindo-nav', '.mobile-menu': '.saindo-mobile-menu', '.mobile-menu.open': '.saindo-mobile-menu.open', '.mobile-link': '.saindo-mobile-menu .mobile-link', '.mobile-link:hover, .mobile-link--active': '.saindo-mobile-menu .mobile-link:hover, .saindo-mobile-menu .mobile-link--active', '.mobile-link--cta': '.saindo-mobile-menu .mobile-link--cta', '.mobile-sep': '.saindo-mobile-menu .mobile-sep'}) + "\n"
site_css += "/* --- Contact --- */\n" + prefix_css(dedent(block(contact_src, 'style')), '.saindo-contact', {'.section-contact': '.saindo-contact'}) + "\n"
site_css += "/* --- Pied de page --- */\n" + prefix_css(dedent(block(read('src/components/Footer.astro'), 'style')), '.saindo-footer', {'footer': '.saindo-footer'}) + "\n"
(PLUGIN / 'assets' / 'site.css').write_text(site_css)

site_js = "/* Menu mobile, lightbox des plans et vidéo de l'accueil — porté depuis les scripts Astro. */\n(function () {\n"
site_js += "  var hamburger = document.getElementById('hamburger');\n  var mobileMenu = document.getElementById('mobile-menu');\n  if (hamburger && mobileMenu) {\n"
site_js += '\n'.join('    ' + l for l in js(block(nav_src, 'script')).splitlines()[2:]) + "\n  }\n\n"
site_js += "  var lightbox = document.getElementById('lightbox');\n  if (lightbox) {\n"
site_js += '\n'.join('    ' + l for l in js(block(read('src/pages/j-ai-un-projet.astro'), 'script')).splitlines()[1:]) + "\n  }\n\n"
site_js += "  var facade = document.getElementById('video-facade');\n  var wrapper = document.getElementById('video-wrapper');\n  if (facade && wrapper) {\n"
site_js += '\n'.join('    ' + l for l in js(block(read('src/pages/index.astro'), 'script')).splitlines()[2:]) + "\n  }\n})();\n"
site_js = site_js.replace('facade?.addEventListener', 'facade.addEventListener')
(PLUGIN / 'assets' / 'site.js').write_text(site_js)

# ---- Pages
def page(slug, title, html, css, extra_html=''):
    css_out = ROOT_VARS + '\n' + prefix_css(css, '.saindo-page', {'main': '.saindo-main', '.container': '.saindo-page .container'})
    content = f"<!-- wp:html -->\n<style>\n{css_out}\n</style>\n<div class=\"saindo-page saindo-page--{slug}\">\n{html}\n</div>\n{extra_html}<!-- /wp:html -->"
    (OUT / f'{slug}.json').write_text(json.dumps({'slug': slug, 'title': title, 'content': content, 'status': 'publish', 'template': 'saindo'}, ensure_ascii=False))
    print(f'{slug:24s} html {len(html):6d}  css {len(css_out):6d}')

def main_inner(src):
    m = re.search(r'<main>(.*?)</main>', src, re.S); return fix_links(strip_comments(m.group(1))).strip('\n')

src = read('src/pages/index.astro')
body = src[src.index('<Nav activePage="home" />') + len('<Nav activePage="home" />'):src.index('<ContactSection />')]
g0 = body.index('<div class="gauge">'); g1 = body.index('<div class="hero-cta-cards">')
body = body[:g0] + '[saindo_jauge]\n\n      ' + body[g1:]
page('accueil', 'Accueil', fix_links(strip_comments(body)).strip('\n'), dedent(block(src, 'style')))

src = read('src/pages/je-contribue.astro')
page('je-contribue', 'Je contribue', '<div class="saindo-main">' + main_inner(src) + '</div>', dedent(block(src, 'style')))

src = read('src/pages/j-ai-un-projet.astro')
lb = src[src.index('<div id="lightbox"'):src.index('<ContactSection />')].strip()
page('j-ai-un-projet', "J'ai un projet", '<div class="saindo-main">' + main_inner(src) + '</div>\n' + lb, dedent(block(src, 'style')))

src = read('src/pages/qui-sommes-nous.astro')
page('qui-sommes-nous', 'Qui sommes-nous', '<div class="saindo-main">' + main_inner(src) + '</div>', dedent(block(src, 'style')))

src = read('src/pages/faq.astro')
inner = main_inner(src)
inner = re.sub(r'\{faqHtml \? \(.*?\)\}', '<div class="faq-content">\n' + FAQ_HTML + '</div>', inner, flags=re.S)
page('faq', 'FAQ', '<div class="saindo-main">' + inner + '</div>', dedent(block(src, 'style')))

(OUT / 'questionnaire-projet.json').write_text(json.dumps({'slug': 'questionnaire-projet', 'title': 'Questionnaire porteur·se de projet',
    'content': '<!-- wp:html -->\n<div class="saindo-page saindo-page--questionnaire"><div class="saindo-main" style="padding: 64px 24px 96px">[saindo_questionnaire]</div></div>\n<!-- /wp:html -->',
    'status': 'publish', 'template': 'saindo'}, ensure_ascii=False))
print('questionnaire-projet     shortcode')
