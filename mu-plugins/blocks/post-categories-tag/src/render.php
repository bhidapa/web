<?php
/**
 * @var array     $attributes
 * @var string    $content
 * @var WP_Block  $block
 */

$categories = get_the_category();
if (empty($categories)) {
    // no post typed detected, render nothing
    return;
}

foreach ($categories as $cat): ?>

    <div <?php echo get_block_wrapper_attributes(); ?>>
        <a href="<?php echo get_term_link($cat); ?>">
            <?php echo esc_html($cat->name); ?>
        </a>
    </div>

<?php endforeach;
?>
