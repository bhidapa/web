<?php
$field = $block->context['bhidapa/acf-repeater_field'];
if (!have_rows($field)) {
    return;
}

// NOTE: this block is not rendered with a wrapper div because we want each of the items in the repeater to be rendered as a separate block in the container
// echo '<div ' . get_block_wrapper_attributes() . '>';

while (have_rows($field)) {
    the_row();

    $inner_blocks_html = '';
    foreach ($block->inner_blocks as $inner_block) {
        $inner_blocks_html .= $inner_block->render();
    }
    echo $inner_blocks_html;
}

// echo '</div>';

?>
