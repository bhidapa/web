<?php

acf_form_head(); // must be here, not in any action or filter

add_shortcode('acf_form', function ($atts) {
    ob_start();
    acf_form([
        'field_groups' => [$atts['group_id']],
    ]);
    return ob_get_clean();
});

// // sanduce povjerenja / trust_box

// add_action('acf/init', function () {
//     acf_register_form([
//         'id' => 'trust_box',
//         'return' => '?sent=true',
//         'submit_value' => __('Pošalji', 'azp'),
//         'html_updated_message' =>
//             '<div class="acf-form-updated_message"><i class="fa-solid fa-paper-plane"></i> Poruka poslana! Hvala Vam na povjerenju.</div>',
//     ]);
// });

// add_shortcode('trust_box_form', function () {
//     ob_start();
//     acf_form('trust_box');
//     return ob_get_clean();
// });
