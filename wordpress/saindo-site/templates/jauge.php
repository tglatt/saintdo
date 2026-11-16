<?php
/** @var array|null $c  Données de /api/public/collecte */
if (!defined('ABSPATH')) exit;
if (!$c) {
    echo '<div class="saindo-gauge saindo-gauge--empty"><p>Les chiffres de la collecte sont momentanément indisponibles.</p></div>';
    return;
}
$prochain = $c['prochain'] ?? null;
$dernier  = $c['dernierAtteint'] ?? null;
$paliers  = $c['paliers'] ?? [];
?>
<div class="saindo-gauge">
  <?php if ($dernier): ?>
    <div class="gauge-flag">
      <span class="gauge-flag-check">✓</span>
      <span>
        <strong><?= esc_html($dernier['annonce']) ?></strong>
        <?= $prochain ? ' Objectif suivant : ' . esc_html($prochain['label']) . '.' : ' Merci à toutes et tous !' ?>
      </span>
    </div>
  <?php endif; ?>

  <p class="gauge-collecte-title">Collecté à ce jour</p>
  <div class="gauge-amounts">
    <div class="gauge-total"><?= esc_html(saindo_euros($c['totalAvecSubventions'])) ?></div>
    <div class="gauge-amounts-right">
      <div class="gauge-pct"><?= (int) $c['pct'] ?> %</div>
      <div class="gauge-goal">sur <?= esc_html(saindo_euros($c['objectif'])) ?></div>
    </div>
  </div>

  <div class="gauge-bar">
    <div class="gauge-fill gauge-fill--subvention" style="width: <?= (int) $c['pctSubventions'] ?>%"></div>
    <div class="gauge-fill gauge-fill--apport" style="width: <?= (int) $c['pctApport'] ?>%"></div>
    <div class="gauge-fill gauge-fill--don" style="width: <?= (int) $c['pctDon'] ?>%"></div>
    <?php foreach (array_slice($paliers, 0, -1) as $p): ?>
      <div class="gauge-marker" style="left: <?= (int) $p['pct'] ?>%"></div>
    <?php endforeach; ?>
  </div>

  <div class="gauge-details">
    <span><strong style="color: #8E8BC4"><?= esc_html(saindo_euros($c['subventions'])) ?></strong><em>subventions</em></span>
    <span><strong style="color: #B0ADD4"><?= esc_html(saindo_euros($c['apport'])) ?></strong><em>apports associatifs</em></span>
    <span><strong style="color: #DFC85A"><?= esc_html(saindo_euros($c['don'])) ?></strong><em>adhésions &amp; dons</em></span>
  </div>

  <div class="gauge-participants">
    <strong><?= (int) $c['participants'] ?></strong> participant<?= $c['participants'] > 1 ? 's' : '' ?>
  </div>

  <div class="gauge-steps">
    <p class="gauge-steps-title">Les paliers de la collecte</p>
    <ul class="gauge-paliers">
      <?php foreach ($paliers as $p):
        $isNext = $prochain && $p['montant'] === $prochain['montant'];
        $cls = 'gauge-palier' . ($p['atteint'] ? ' gauge-palier--done' : '') . ($isNext ? ' gauge-palier--next' : '');
      ?>
        <li class="<?= $cls ?>">
          <span class="gauge-palier-dot"><?= $p['atteint'] ? '✓' : '' ?></span>
          <strong><?= esc_html(saindo_euros($p['montant'])) ?></strong>
          <em><?= esc_html($p['label']) ?></em>
          <span class="gauge-palier-etat"><?= $p['atteint'] ? 'atteint' : ($isNext ? 'en cours' : 'à venir') ?></span>
        </li>
      <?php endforeach; ?>
    </ul>
  </div>
</div>
