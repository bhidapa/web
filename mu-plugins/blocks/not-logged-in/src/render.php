<?php
/**
 * @var array     $attributes
 * @var string    $content
 * @var WP_Block  $block
 */
global $attributes, $content, $block;

if (is_user_logged_in()) {
    return;
}

$inner_blocks_html = '';
foreach ($block->inner_blocks as $inner_block) {
    $inner_blocks_html .= $inner_block->render();
}
echo $inner_blocks_html;
?>
