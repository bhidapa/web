<?php
/**
 * Plugin Name:     BHIDAPA
 * Author:          Bosansko-hercegovačka integrativna dječija i adolescentna psihoterapijska Asocijacija
 * Description:     Core plugins, functionalities and blocks for BHIDAPA websites
 * Version:         0.0.0
 */

add_action('init', function () {
    register_blocks();
});

// Override REST API requests to use internal proxy hostname because we're using
// PHP-FPM with NGINX. The implementation is fast and secure because it replaces only
// the first occurrence of the hostname in the url.
add_filter('rest_url', function ($url) {
    $internal_proxy_host = getenv('INTERNAL_PROXY_HOST');
    $internal_proxy_port = getenv('INTERNAL_PROXY_PORT');
    if ($internal_proxy_host || $internal_proxy_port) {
        $parsed_url = wp_parse_url($url);
        $parsed_url['scheme'] = 'http'; // Internal requests are always http
        if ($internal_proxy_host) {
            $parsed_url['host'] = $internal_proxy_host;
        }
        if ($internal_proxy_port) {
            $parsed_url['port'] = $internal_proxy_port;
        }
        return unparse_url($parsed_url);
    }
    return $url;
});

function register_blocks()
{
    $path = dirname(__FILE__) . '/blocks/';
    $dir = @opendir($path);
    if ($dir) {
        while ($file = readdir($dir)) {
            $block_json_path = $path . $file . '/build/block.json';
            if (file_exists($block_json_path)) {
                register_block_type($path . $file . '/build/block.json');
            }
        }
    }
    @closedir($dir);
}

/** I hate that there is no simpler way of doing this. */
function unparse_url(array $parsed_url): string
{
    $scheme = isset($parsed_url['scheme']) ? $parsed_url['scheme'] . '://' : '';
    $host = isset($parsed_url['host']) ? $parsed_url['host'] : '';
    $port = isset($parsed_url['port']) ? ':' . $parsed_url['port'] : '';
    $user = isset($parsed_url['user']) ? $parsed_url['user'] : '';
    $pass = isset($parsed_url['pass']) ? ':' . $parsed_url['pass'] : '';
    $pass = $user || $pass ? "$pass@" : '';
    $path = isset($parsed_url['path']) ? $parsed_url['path'] : '';
    $query = isset($parsed_url['query']) ? '?' . $parsed_url['query'] : '';
    $fragment = isset($parsed_url['fragment'])
        ? '#' . $parsed_url['fragment']
        : '';
    return "$scheme$user$pass$host$port$path$query$fragment";
}
