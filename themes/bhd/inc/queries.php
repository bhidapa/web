<?php
add_action('pre_get_posts', 'custom_posts_order');
function custom_posts_order(WP_Query $query)
{
    if (is_tax('uloga-clana-osoblja')) {
        $query->set('order', 'ASC');
        $query->set('orderby', 'date');
    }
    if (is_tax('studijska-grupa')) {
        $query->set('order', 'ASC');
        $query->set('orderby', 'date');
    }
    if (is_tax('edukacijski-program')) {
        $query->set('order', 'ASC');
        $query->set('orderby', 'date');
    }
}
