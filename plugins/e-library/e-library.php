<?php
/**
 * Plugin Name: E-Library
 * Author:      BHIDAPA
 * Author URI:  https://bhidapa.ba/
 * Description: A simple e-library plugin for managing access to protected resources.
 * Version:     0.0.0
 */

require_once 'student.php';
require_once 'library.php';

/**
 * Set up the E-Library.
 *
 * @param string $unauthorized_template_id The ID of the template to display for unauthorized access.
 */
function e_library_setup(string $unauthorized_template_id)
{
    global $e_library;
    $e_library = new E_Library(
        new E_Library_Student(),
        $unauthorized_template_id,
    );

    register_block_type(
        dirname(__FILE__) . '/blocks/e-library/build/block.json',
    );
    register_block_type(
        dirname(__FILE__) . '/blocks/has-access/build/block.json',
    );
    register_block_type(
        dirname(__FILE__) . '/blocks/no-access/build/block.json',
    );
}
