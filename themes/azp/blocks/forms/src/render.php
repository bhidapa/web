<?php
/**
 * @var array     $attributes
 * @var string    $content
 * @var WP_Block  $block
 */

// we use wp-components for rendering our forms (prijave)
wp_enqueue_style('wp-components');

echo $content;
