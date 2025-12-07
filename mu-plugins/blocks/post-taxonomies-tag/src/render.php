<?php
/**
 * @var array     $attributes
 * @var string    $content
 * @var WP_Block  $block
 */

$terms = get_the_terms(get_post(), $attributes['taxonomy'] ?? 'category');
if (empty($terms)) {
    // no terms detected, render nothing
    return;
}

foreach ($terms as $term): ?>

    <div <?php echo get_block_wrapper_attributes(); ?>>
        <a href="<?php echo get_term_link($term); ?>">
            <?php echo esc_html($term->name); ?>
        </a>
    </div>

<?php endforeach;
?>
