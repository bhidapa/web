<?php

/*
<!-- wp:paragraph {
    "metadata":{
        "bindings":{
            "content":{
                "source":"bhidapa/acf-field",
                "args": {
                    "key":"subtitle",
                    "sub": false
                }
            }
        }
    }
} -->
*/

add_action('init', function () {
    register_block_bindings_source('bhidapa/acf-field', [
        'label' => __('ACF Field', 'bhidapa'),
        'get_value_callback' => function (array $source_args) {
            if ($source_args['sub']) {
                return get_sub_field($source_args['key']);
            }
            return get_field($source_args['key']);
        },
    ]);
    register_block_bindings_source('bhidapa/login-url-with-return-redirect', [
        'label' => __('Login URL with return redirect', 'bhidapa'),
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
    register_block_bindings_source('bhidapa/logout-url-with-return-redirect', [
        'label' => __('Logout URL with return redirect', 'bhidapa'),
        'get_value_callback' => function () {
            $redirect_to = $_GET['redirect_to'] ?? '';
            if (!empty($redirect_to)) {
                return wp_logout_url($redirect_to);
            }
            /** @var WP */
            global $wp;
            return wp_logout_url($wp->request);
        },
    ]);
    register_block_bindings_source('bhidapa/post-title', [
        'label' => __('Post Title', 'bhidapa'),
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
    register_block_bindings_source('bhidapa/current-user', [
        'label' => __('Current User', 'bhidapa'),
        'get_value_callback' => function (array $source_args) {
            $user = wp_get_current_user();
            if (!$user->exists()) {
                return '';
            }
            $value = match ($source_args['key'] ?? '') {
                'display_name' => $user->display_name,
                'email' => $user->user_email,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'login' => $user->user_login,
                default => '',
            };
            $prefix = $source_args['prefix'] ?? '';
            $suffix = $source_args['suffix'] ?? '';
            return $prefix . $value . $suffix;
        },
    ]);
});
