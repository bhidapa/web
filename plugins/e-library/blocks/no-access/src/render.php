<?php
/**
 * @var array     $attributes
 * @var string    $content
 * @var WP_Block  $block
 */
global $attributes, $content, $block;

if ($attributes['mustBeLoggedIn'] && !is_user_logged_in()) {
    return;
}

/** @var E_Library */
global $e_library;

if ($e_library->has_current_user_access_to_the_study_group()) {
    return;
}

$inner_blocks_html = '';
foreach ($block->inner_blocks as $inner_block) {
    $inner_blocks_html .= $inner_block->render();
}
echo $inner_blocks_html;
?>
