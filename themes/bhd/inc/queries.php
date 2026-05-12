<?php
function natural_sort_orderby()
{
    global $wpdb;
    // remove immediately so it doesn't bleed into other queries on the same request
    remove_filter('posts_orderby', 'natural_sort_orderby');
    // extract the first number from the title and sort by it as an integer,
    // so "MODUL 2" comes before "MODUL 12" instead of after
    return "CAST(REGEXP_SUBSTR({$wpdb->posts}.post_title, '[0-9]+') AS UNSIGNED) ASC, {$wpdb->posts}.post_title ASC";
}

add_action('pre_get_posts', 'custom_posts_order');
function custom_posts_order(WP_Query $query)
{
    if (is_tax('uloga-clana-osoblja')) {
        $query->set('order', 'ASC');
        $query->set('orderby', 'date');
    }
    if (is_tax('grupa-strucnjaka')) {
        add_filter('posts_orderby', 'natural_sort_orderby');
    }
    if (is_tax('obuka')) {
        add_filter('posts_orderby', 'natural_sort_orderby');
    }
    if (is_tax('projekat')) {
        add_filter('posts_orderby', 'natural_sort_orderby');
    }
}
