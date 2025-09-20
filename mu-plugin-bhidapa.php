<?php
/**
 * Plugin Name:     BHIDAPA Core
 * Author:          BHIDAPA
 * Description:     Core plugins, functionalities and blocks for BHIDAPA websites
 * Version:         0.0.0
 */

add_action('init', function () {
    register_block_type(
        dirname(__FILE__) . '/bhidapa/blocks/post-type/build/block.json',
    );
});
