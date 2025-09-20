<?php
add_action('init', function () {
    register_block_bindings_source('azp/acf-field', [
        'label' => __('ACF Field', 'azp'),
        'get_value_callback' => function (array $source_args) {
            if ($source_args['sub']) {
                return get_sub_field($source_args['key']);
            }
            return get_field($source_args['key']);
        },
    ]);
    register_block_bindings_source('azp/login-url-with-return-redirect', [
        'label' => __('Login URL with return redirect', 'azp'),
        'get_value_callback' => function () {
            $redirect_to = $_GET['redirect_to'] ?? '';
            if (!empty($redirect_to)) {
                return wp_login_url($redirect_to);
            }
            /** @var WP */
            global $wp;
            return wp_login_url($wp->request);
        },
    ]);
    register_block_bindings_source('azp/post-title', [
        'label' => __('Post Title', 'azp'),
        'get_value_callback' => function (array $source_args) {
            if ($source_args['link']) {
                return '<a href="' .
                    get_permalink() .
                    '">' .
                    get_the_title() .
                    '</a>';
            }
            return get_the_title();
        },
    ]);
});
