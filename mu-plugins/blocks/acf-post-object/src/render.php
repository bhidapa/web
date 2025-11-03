<?php
/** @var WP_Post */
global $post;

/**
 * @var array     $attributes
 * @var string    $content
 * @var WP_Block  $block
 */

// NOTE: this block is not rendered with a wrapper div because we want each of the items in the repeater to be rendered as a separate block in the container
// echo '<div ' . get_block_wrapper_attributes() . '>';

$field = get_field($attributes['field']);
if (empty($field)) {
    return;
}
foreach ($field instanceof WP_Post ? [$field] : $field as $post) {
    setup_postdata($post);

    // set context for the inner blocks
    // https://github.com/WordPress/gutenberg/blob/f073488d629de356e183efd722ec3d05d8119cd3/packages/block-library/src/post-template/index.php
    $post_id = get_the_ID();
    $post_type = get_post_type();
    $filter_block_context = static function ($context) use (
        $post_id,
        $post_type,
    ) {
        $context['postType'] = $post_type;
        $context['postId'] = $post_id;
        return $context;
    };
    add_filter('render_block_context', $filter_block_context, 1);

    $inner_blocks_html = '';
    foreach ($block->inner_blocks as $inner_block) {
        $inner_blocks_html .= $inner_block->render();
    }
    echo $inner_blocks_html;

    remove_filter('render_block_context', $filter_block_context, 1);

    wp_reset_postdata();
}

// echo '</div>';

?>
