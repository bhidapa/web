<p <?php echo get_block_wrapper_attributes(); ?>>
	<?php
 /**
  * @var array     $attributes
  * @var string    $content
  * @var WP_Block  $block
  */

 $subField = $attributes['subField'] ?? false;
 $field = $subField
     ? get_sub_field_object($attributes['field'])
     : get_field_object($attributes['field']);
 if (!$field) {
     // field object is "false" when none available
     return;
 }

 echo do_shortcode($attributes['prefix'] ?? '');

 if ($field['type'] == 'select') {
     $choiceValue = $subField
         ? get_sub_field(
             $attributes['field'],
             false,
             false, // we dont want the formatted version ever here because we'll be using the label in choices
         )
         : get_field(
             $attributes['field'],
             false,
             false, // we dont want the formatted version ever here because we'll be using the label in choices
         );
     $choiceLabel = $field['choices'][$choiceValue];

     if ($field['name'] == 'location' && $choiceValue == 'academy') {
         echo '<a href="https://maps.app.goo.gl/oaUggQ9vCeMtx3f16">' .
             $choiceLabel .
             '</a>';
     } elseif ($field['name'] == 'location' && $choiceValue == 'mozaik') {
         echo '<a href="https://maps.app.goo.gl/BKWcFMdtXXL1YTde6">' .
             $choiceLabel .
             '</a>';
     } else {
         echo $choiceLabel;
     }
 } else {
     $subField
         ? the_sub_field($attributes['field'])
         : the_field($attributes['field']);
 }

 echo do_shortcode($attributes['suffix'] ?? '');
 ?>
</p>
