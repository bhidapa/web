<div <?php echo get_block_wrapper_attributes(); ?>>
<?php
$inner_blocks_html = '';
foreach ($block->inner_blocks as $inner_block) {
    $inner_blocks_html .= $inner_block->render();
}
echo $inner_blocks_html;
?>
</div>
