<?php
/**
 * Plugin Name: Core
 * Author:      BHIDAPA
 * Author URI:  https://bhidapa.ba/
 * Description: Shared plugins, functionalities and blocks for BHIDAPA websites
 * Version:     0.0.0
 */

require_once 'bindings/index.php';

add_action('init', function () {
    register_blocks_in_dir(dirname(__FILE__) . '/blocks/');
});

/**
 * Register all Gutenberg blocks within the provided directory.
 * It will register all blocks by appending `/build/block.json`
 * to every directory inside the provided $path.
 */
function register_blocks_in_dir(string $path)
{
    $dir = @opendir($path);
    if ($dir) {
        while ($file = readdir($dir)) {
            $block_json_path = $path . $file . '/build/block.json';
            if (file_exists($block_json_path)) {
                register_block_type($path . $file . '/build/block.json');
            }
        }
    }
    @closedir($dir);
}

add_action('wp_enqueue_scripts', function () {
    wp_enqueue_script(
        'core-script',
        plugins_url('script.js', __FILE__),
        [],
        '1.0.0',
        ['type' => 'module'],
    );
});

add_filter('c3_invalidation_interval', function () {
    $custom_interval_minutes = 15;
    return $custom_interval_minutes;
});
