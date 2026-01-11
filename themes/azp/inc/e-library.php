<?php
/**
 * Register and set up E-Library. Needs the plugin to be activated first.
 */
add_action('init', function () {
    if (function_exists('e_library_setup')) {
        e_library_setup('azp//e-library-unauthorized', 'studijska-grupa');
    }
});
