<?php if (!defined('ABSPATH')) exit; ?>
<footer class="saindo-footer">
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
</footer>
