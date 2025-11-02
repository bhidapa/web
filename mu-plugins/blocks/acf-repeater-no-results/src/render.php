<?php
if (have_rows($block->context['bhidapa/acf-repeater_field'])) {
    // there are rows in the repeatable, nothing to render (show no results)
    return;
}

$inner_blocks_html = '';
foreach ($block->inner_blocks as $inner_block) {
    $inner_blocks_html .= $inner_block->render();
}
echo $inner_blocks_html;

?>
