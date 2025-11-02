<?php
/**
 * Functions and definitions
 *
 * @link https://developer.wordpress.org/themes/basics/theme-functions/
 *
 * @package azp
 * @since 1.0.0
 */

require_once 'inc/queries.php';
require_once 'inc/forms.php';
require_once 'inc/e-library.php';

// fix some wordpress default translations
unload_textdomain('default');
load_textdomain(
    'default',
    get_template_directory() . '/languages/default-' . get_locale() . '.mo',
);

add_action('login_enqueue_scripts', function () {
    echo '<style type="text/css">
    #login h1 a, .login h1 a {
        background-image: url(' .
        get_theme_file_uri('assets/images/logo-text-powered-by.svg') .
        ');
        height: 100px;
        width: 100%;
        background-size: contain;
    }
</style>';
});

add_action('init', function () {
    register_block_style('core/button', [
        'name' => 'naked',
        'label' => __('Naked', 'azp'),
    ]);
});

add_action('admin_init', function () {
    add_editor_style('editor-style.css');
});

add_action(
    'wp_enqueue_scripts',
    function () {
        wp_enqueue_style(
            'azp-style',
            get_stylesheet_uri(),
            [],
            wp_get_theme()->get('Version'),
        );
    },
    50, // load stylesheet last overriding all other styles
);

add_filter('upload_mimes', function ($mimes) {
    $mimes['svg'] = 'image/svg+xml';
    return $mimes;
});

// Disable comments
add_action('admin_init', function () {
    // Redirect any user trying to access comments page
    global $pagenow;

    if ($pagenow === 'edit-comments.php') {
        wp_safe_redirect(admin_url());
        exit();
    }

    // Remove comments metabox from dashboard
    remove_meta_box('dashboard_recent_comments', 'dashboard', 'normal');

    // Disable support for comments and trackbacks in post types
    foreach (get_post_types() as $post_type) {
        if (post_type_supports($post_type, 'comments')) {
            remove_post_type_support($post_type, 'comments');
            remove_post_type_support($post_type, 'trackbacks');
        }
    }
});
// Close comments on the front-end
add_filter('comments_open', '__return_false', 20, 2);
add_filter('pings_open', '__return_false', 20, 2);
// Hide existing comments
add_filter('comments_array', '__return_empty_array', 10, 2);
// Remove comments from toolbar
add_action('wp_before_admin_bar_render', function () {
    global $wp_admin_bar;
    $wp_admin_bar->remove_menu('comments');
});
// Remove comments page in menu
add_action('admin_menu', function () {
    remove_menu_page('edit-comments.php');
});
// Remove comments links from admin bar
add_action('init', function () {
    if (is_admin_bar_showing()) {
        remove_action('admin_bar_menu', 'wp_admin_bar_comments_menu', 60);
    }
});

// editors can edit theme
$role_object = get_role('editor');
$role_object->add_cap('edit_theme_options');

// parse shortcodes in template parts
// https://core.trac.wordpress.org/ticket/58333#comment:72
function parse_inner_blocks(&$parsed_block)
{
    foreach ($parsed_block['innerBlocks'] as &$inner_block) {
        if ($inner_block['blockName'] == 'core/post-excerpt') {
            // render shortcodes in post-excerpts (moreText is an attribute)
            foreach ($inner_block['attrs'] as &$attr_content) {
                if (!empty($attr_content) && is_string($attr_content)) {
                    $attr_content = do_shortcode($attr_content);
                }
            }
        }
        foreach ($inner_block['innerContent'] as &$inner_content) {
            if (!empty($inner_content)) {
                $inner_content = do_shortcode($inner_content);
            }
        }
        $inner_block = parse_inner_blocks($inner_block);
    }
    return $parsed_block;
}
add_filter('render_block_data', function ($parsed_block) {
    foreach ($parsed_block['innerContent'] as &$inner_content) {
        if (!empty($inner_content)) {
            $inner_content = do_shortcode($inner_content);
        }
    }
    return parse_inner_blocks($parsed_block);
});

add_filter(
    'get_block_type_variations',
    function (array $variations, WP_Block_Type $block_type) {
        if ($block_type->name !== 'core/button') {
            return $variations;
        }

        // Add a custom variation
        $variations[] = [
            'name' => 'download-button',
            'title' => __('Download button', 'azp'),
            'description' => __(
                'A button that initiates a download of the href',
                'azp',
            ),
            'attributes' => [
                'type' => 'download',
            ],
            'isActive' => ['type'],
        ];

        return $variations;
    },
    10,
    2,
);

add_filter(
    'render_block_core/button',
    function (string $block_content, array $block) {
        $attr_type = $block['attrs']['type'] ?? null;
        if ($attr_type === 'download') {
            $block_content = new WP_HTML_Tag_Processor($block_content);

            // go to root element and add the download-icon class
            $block_content->next_tag();
            $block_content->add_class('download-icon');

            // then go to the anchor and add the download attr
            $block_content->next_tag('A');
            $block_content->set_attribute('download', true);

            // update html
            return $block_content->get_updated_html();
        }
        return $block_content;
    },
    10,
    2,
);

add_action('wp_before_admin_bar_render', function () {
    /** @var WP_Admin_Bar */
    global $wp_admin_bar;
    $wp_admin_bar->remove_menu('wp-logo');
});

add_filter('wpcf7_autop_or_not', function () {
    return false;
});
