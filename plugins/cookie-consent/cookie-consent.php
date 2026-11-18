<?php
/**
 * Plugin Name: Cookie Consent
 * Author:      BHIDAPA
 * Author URI:  https://bhidapa.ba/
 * Description: Cookie consent banner using vanilla-cookieconsent that reports the visitor's choice to the WP Consent API and is translatable through Polylang.
 * Version:     0.0.0
 * Requires Plugins: wp-consent-api
 */

/**
 * The banner texts keyed by their name in the banner config. The values are
 * the source strings, which are translated per language in Polylang under
 * Languages > Translations, group "Cookie Consent".
 */
function cookie_consent_strings(): array
{
    return [
        'consentTitle' => 'We use cookies',
        'consentDescription' =>
            'We use necessary cookies to make this site work. With your permission, we also use analytics cookies to understand how the site is used.',
        'acceptAllBtn' => 'Accept all',
        'acceptNecessaryBtn' => 'Necessary only',
        'showPreferencesBtn' => 'Choose preferences',
        'preferencesTitle' => 'Cookie preferences',
        'savePreferencesBtn' => 'Save preferences',
        'closeIconLabel' => 'Close preferences',
        'serviceCounterLabel' => 'Service|Services',
        'alwaysEnabled' => 'Always enabled',
        'usageTitle' => 'How we use cookies',
        'usageDescription' =>
            'You can choose whether to allow analytics cookies. Necessary cookies are always enabled because they store your consent choice and support essential site features.',
        'necessaryTitle' => 'Necessary cookies',
        'necessaryDescription' =>
            'These cookies remember your privacy choices and support essential site features. They cannot be disabled.',
        'analyticsTitle' => 'Analytics cookies',
        'analyticsDescription' =>
            'Help us understand visits and how the site is used. These cookies are used only with your permission.',
        'questionsTitle' => 'Questions',
        // keeps the link inside the string so translators can place it where their grammar needs it
        'questionsDescription' =>
            'If you have questions about cookies or your choices, <a class="cc__link" href="mailto:info@bhidapa.ba">contact us</a>.',
    ];
}

add_action('init', function () {
    if (!function_exists('pll_register_string')) {
        return;
    }
    foreach (cookie_consent_strings() as $name => $string) {
        pll_register_string($name, $string, 'Cookie Consent', true);
    }
});

// visitors must opt in, so the wp consent api treats every category without an explicit "allow" as denied
add_filter('wp_get_consent_type', fn() => 'optin');

// site kit's consent mode only denies by default in the eea, switzerland and the uk, dropping the region denies for every visitor
add_filter('googlesitekit_consent_defaults', function ($defaults) {
    unset($defaults['region']);
    // site kit grants a stored choice on DOMContentLoaded from a footer script, its 500ms default can let the first page view go out without consent
    $defaults['wait_for_update'] = 2000;
    return $defaults;
});

add_action('wp_enqueue_scripts', function () {
    wp_enqueue_style(
        'vanilla-cookieconsent',
        plugins_url('lib/cookieconsent.css', __FILE__),
        [],
        '3.1.0',
    );
    wp_enqueue_script(
        'vanilla-cookieconsent',
        plugins_url('lib/cookieconsent.umd.js', __FILE__),
        [],
        '3.1.0',
        ['in_footer' => true],
    );
    wp_enqueue_script(
        'cookie-consent',
        plugins_url('script.js', __FILE__),
        // wp-consent-api provides wp_set_consent which site kit listens to for google consent mode updates
        ['vanilla-cookieconsent', 'wp-consent-api'],
        // bump when changing script.js so caches pick it up
        '0.0.0',
        ['in_footer' => true],
    );

    // translate on the server so the banner matches the polylang language of the page
    $translations = [];
    foreach (cookie_consent_strings() as $name => $string) {
        $translations[$name] = function_exists('pll__')
            ? pll__($string)
            : $string;
    }
    $lang = function_exists('pll_current_language')
        ? pll_current_language()
        : null;
    wp_add_inline_script(
        'cookie-consent',
        'window.cookieConsent = ' .
            wp_json_encode([
                'lang' => $lang ?: substr(get_locale(), 0, 2),
                'translations' => $translations,
            ]) .
            ';',
        'before',
    );
});
