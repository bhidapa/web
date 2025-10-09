<?php
/**
 * Plugin Name:     BHIDAPA
 * Author:          Bosansko-hercegovačka integrativna dječija i adolescentna psihoterapijska Asocijacija
 * Description:     Core plugins, functionalities and blocks for BHIDAPA websites
 * Version:         0.0.0
 */

add_action('init', function () {
    register_blocks();
});

function register_blocks()
{
    $path = dirname(__FILE__) . '/blocks/';
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
