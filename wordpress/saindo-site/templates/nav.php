<?php
/** @var string $active  slug de la page courante */
if (!defined('ABSPATH')) exit;
?>
<nav class="saindo-nav">
  <div class="nav-inner">
    <a href="<?= esc_url(home_url('/')) ?>" class="brand">Le Saindo</a>
    <div class="nav-links">
      <a href="<?= esc_url(home_url('/je-contribue/')) ?>" class="nav-link <?= $active === 'je-contribue' ? 'nav-link--active' : '' ?>">Je contribue</a>
      <a href="<?= esc_url(home_url('/j-ai-un-projet/')) ?>" class="nav-link <?= $active === 'j-ai-un-projet' ? 'nav-link--active' : '' ?>">J'ai un projet</a>
      <a href="<?= esc_url(home_url('/faq/')) ?>" class="nav-link <?= $active === 'faq' ? 'nav-link--active' : '' ?>">Je questionne</a>
      <a href="<?= esc_url(home_url('/qui-sommes-nous/')) ?>" class="nav-link <?= $active === 'qui-sommes-nous' ? 'nav-link--active' : '' ?>">Qui sommes-nous</a>
    </div>
    <div class="nav-actions">
      <a href="<?= esc_url(home_url('/#contact')) ?>" class="btn btn-nav">Contact</a>
      <a href="<?= esc_url(saindo_app_url() . '/login') ?>" class="btn btn-nav btn-nav-outline">Se connecter</a>
    </div>
    <button class="hamburger" id="hamburger" aria-label="Menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>

<div class="saindo-mobile-menu" id="mobile-menu" aria-hidden="true">
  <a href="<?= esc_url(home_url('/je-contribue/')) ?>" class="mobile-link <?= $active === 'je-contribue' ? 'mobile-link--active' : '' ?>">Je contribue</a>
  <a href="<?= esc_url(home_url('/j-ai-un-projet/')) ?>" class="mobile-link <?= $active === 'j-ai-un-projet' ? 'mobile-link--active' : '' ?>">J'ai un projet</a>
  <a href="<?= esc_url(home_url('/faq/')) ?>" class="mobile-link <?= $active === 'faq' ? 'mobile-link--active' : '' ?>">Je questionne</a>
  <a href="<?= esc_url(home_url('/qui-sommes-nous/')) ?>" class="mobile-link <?= $active === 'qui-sommes-nous' ? 'mobile-link--active' : '' ?>">Qui sommes-nous</a>
  <div class="mobile-sep"></div>
  <a href="<?= esc_url(home_url('/#contact')) ?>" class="mobile-link">Contact</a>
  <a href="<?= esc_url(saindo_app_url() . '/login') ?>" class="mobile-link mobile-link--cta">Se connecter</a>
</div>
