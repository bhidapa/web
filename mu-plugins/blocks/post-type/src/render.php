<p <?php echo get_block_wrapper_attributes(); ?>>
    <?php
    /**
     * @var array     $attributes
     * @var string    $content
     * @var WP_Block  $block
     */
    global $attributes, $content, $block;

    $post_type_object = get_post_type_object(get_post_type());
    if (empty($post_type_object)) {
        // no post typed detected, render nothing
        return;
    }
    if ($attributes['icon'] ?? false) {
        echo '<i class="dashicons-before ' .
            $post_type_object->menu_icon .
            '" aria-hidden="true"></i>';
    }
    if ($attributes['plural'] ?? false) {
        echo $post_type_object->labels->name;
    } else {
        echo $post_type_object->labels->singular_name;
    }
    ?>
</p>
