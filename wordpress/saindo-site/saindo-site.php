<?php
/**
 * Plugin Name: Saindo — site vitrine
 * Description: Relie le site WordPress à l'application Saindo (Astro/Vercel) : jauge de collecte, formulaires newsletter et porteur·se de projet, redirections vers l'espace membre.
 * Version: 1.4.1
 * Author: Le Saint-Domingue
 * Requires PHP: 8.0
 * Text Domain: saindo
 */

if (!defined('ABSPATH')) exit;

define('SAINDO_PLUGIN_URL', plugin_dir_url(__FILE__));
define('SAINDO_PLUGIN_DIR', plugin_dir_path(__FILE__));

/* -------------------------------------------------------------------------
 * Réglages : URL de l'application (Réglages → Saindo)
 * ---------------------------------------------------------------------- */

function saindo_app_url(): string {
    if (defined('SAINDO_APP_URL')) return rtrim(SAINDO_APP_URL, '/');
    return rtrim((string) get_option('saindo_app_url', 'https://app.saindo.org'), '/');
}

add_action('admin_init', function () {
    register_setting('saindo', 'saindo_app_url', [
        'type' => 'string',
        'sanitize_callback' => fn($v) => rtrim(esc_url_raw(trim((string) $v)), '/'),
        'default' => 'https://app.saindo.org',
    ]);
    add_settings_section('saindo_main', 'Application Saindo', '__return_false', 'saindo');
    add_settings_field('saindo_app_url', "URL de l'application", function () {
        printf(
            '<input type="url" class="regular-text" name="saindo_app_url" value="%s" placeholder="https://app.saindo.org" />'
            . '<p class="description">Adresse de l\'application Astro (espace membre, admin, API). Sans slash final.</p>',
            esc_attr(saindo_app_url())
        );
    }, 'saindo', 'saindo_main');
});

add_action('admin_menu', function () {
    add_options_page('Saindo', 'Saindo', 'manage_options', 'saindo', function () {
        echo '<div class="wrap"><h1>Saindo</h1><form method="post" action="options.php">';
        settings_fields('saindo');
        do_settings_sections('saindo');
        submit_button();
        echo '</form></div>';
    });
});

/* -------------------------------------------------------------------------
 * Redirections : les URLs de l'application qui existaient sur saindo.org
 * (emails déjà envoyés, favoris) sont renvoyées vers le sous-domaine.
 * ---------------------------------------------------------------------- */

add_action('template_redirect', function () {
    $path = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $prefixes = ['/login', '/logout', '/espace-membre', '/admin', '/age', '/auth', '/api'];
    foreach ($prefixes as $prefix) {
        if ($path === $prefix || str_starts_with($path, $prefix . '/')) {
            $query = (string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_QUERY);
            $target = saindo_app_url() . $path . ($query !== '' ? '?' . $query : '');
            wp_redirect($target, 302);
            exit;
        }
    }
}, 1);

/* -------------------------------------------------------------------------
 * Assets
 * ---------------------------------------------------------------------- */

add_action('wp_enqueue_scripts', function () {
    // Styles et scripts du site vitrine (polices, menu, contact, pied de page, formulaires).
    wp_enqueue_style('saindo-site', SAINDO_PLUGIN_URL . 'assets/site.css', [], '1.4.1');
    wp_enqueue_script('saindo-site', SAINDO_PLUGIN_URL . 'assets/site.js', [], '1.1.0', true);
    wp_register_style('saindo-jauge', SAINDO_PLUGIN_URL . 'assets/jauge.css', [], '1.0.1');
    wp_register_style('saindo-questionnaire', SAINDO_PLUGIN_URL . 'assets/questionnaire.css', [], '1.0.0');
    wp_register_script('saindo-forms', SAINDO_PLUGIN_URL . 'assets/forms.js', [], '1.0.0', true);
    wp_localize_script('saindo-forms', 'SAINDO', ['appUrl' => saindo_app_url()]);
    wp_enqueue_script('saindo-forms'); // le formulaire newsletter est dans le pied de page de toutes les pages
});

// Styles des pages construites en blocs natifs : chargés sur le site et dans l'éditeur.
add_action('enqueue_block_assets', function () {
    wp_enqueue_style('saindo-blocs', SAINDO_PLUGIN_URL . 'assets/blocs.css', [], '1.4.1');
});

// Le questionnaire ne doit pas être indexé (comme sur l'ancien site).
add_filter('wp_robots', function (array $robots) {
    if (is_page('questionnaire-projet')) { $robots['noindex'] = true; $robots['follow'] = true; }
    return $robots;
});

/* -------------------------------------------------------------------------
 * Données de la collecte (JSON exposé par l'application, cache 5 min)
 * ---------------------------------------------------------------------- */

function saindo_get_collecte(): ?array {
    $cached = get_transient('saindo_collecte');
    if (is_array($cached)) return $cached;

    $res = wp_remote_get(saindo_app_url() . '/api/public/collecte', ['timeout' => 8]);
    if (is_wp_error($res) || wp_remote_retrieve_response_code($res) !== 200) {
        // En cas de panne, on garde la dernière valeur connue (sans expiration).
        $stale = get_option('saindo_collecte_last');
        return is_array($stale) ? $stale : null;
    }
    $data = json_decode(wp_remote_retrieve_body($res), true);
    if (!is_array($data) || !isset($data['objectif'])) return null;

    set_transient('saindo_collecte', $data, 5 * MINUTE_IN_SECONDS);
    update_option('saindo_collecte_last', $data, false);
    return $data;
}

function saindo_euros(int|float $n): string {
    return number_format((float) $n, 0, ',', ' ') . ' €';
}

/* -------------------------------------------------------------------------
 * Shortcodes
 *   [saindo_jauge]          jauge de collecte
 *   [saindo_newsletter]     formulaire d'inscription newsletter
 *   [saindo_questionnaire]  questionnaire porteur·se de projet
 *   [saindo_nav]            barre de navigation (en-tête du thème)
 *   [saindo_footer]         pied de page avec inscription newsletter
 * ---------------------------------------------------------------------- */

/**
 * Rend un gabarit du plugin en supprimant les espaces entre balises. Les blocs Shortcode du gabarit
 * de page appliquent wpautop : avec des retours à la ligne, WordPress insère des <p> et <br> parasites
 * (sauts de ligne dans le menu et le pied de page).
 */
function saindo_render(string $template, array $vars = []): string {
    extract($vars);
    ob_start();
    include SAINDO_PLUGIN_DIR . 'templates/' . $template . '.php';
    return preg_replace('/>\s+</', '><', trim(ob_get_clean()));
}

add_shortcode('saindo_nav', function () {
    $active = '';
    if (is_front_page()) $active = 'home';
    elseif (is_page()) { $o = get_queried_object(); $active = $o->post_name ?? ''; }
    return saindo_render('nav', ['active' => $active]);
});

add_shortcode('saindo_footer', fn() => saindo_render('footer'));

add_shortcode('saindo_jauge', function () {
    wp_enqueue_style('saindo-jauge');
    $c = saindo_get_collecte();
    ob_start();
    include SAINDO_PLUGIN_DIR . 'templates/jauge.php';
    return ob_get_clean();
});

add_shortcode('saindo_newsletter', function () {
    wp_enqueue_script('saindo-forms');
    ob_start();
    include SAINDO_PLUGIN_DIR . 'templates/newsletter.php';
    return ob_get_clean();
});

add_shortcode('saindo_questionnaire', function () {
    wp_enqueue_style('saindo-questionnaire');
    wp_enqueue_script('saindo-forms');
    ob_start();
    include SAINDO_PLUGIN_DIR . 'templates/questionnaire.php';
    return ob_get_clean();
});
