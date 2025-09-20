<?php
/**
 * Title: 404
 * Slug: azp/404
 * Inserter: no
 *
 * @package azp
 * @since 1.0.0
 */
?>
<!-- wp:paragraph {"align":"center"} -->
<p class="has-text-align-center has-large-font-size"><?php echo do_shortcode(
    '[icon name="magnifying-glass" prefix="fas"]'
); ?></p>
<!-- /wp:paragraph -->

<!-- wp:heading {"textAlign":"center","level":1} -->
<h1 class="wp-block-heading has-text-align-center">
    <?php esc_html_e('Stranica nije pronađena', 'azp'); ?>
</h1>
<!-- /wp:heading -->

<!-- wp:paragraph {"align":"center","style":{"spacing":{"margin":{"top":"0","bottom":"0"}}}} -->
<p class="has-text-align-center" style="margin-top:0;margin-bottom:0">Čini se da na ovoj lokaciji ništa nije pronađeno.</p>
<!-- /wp:paragraph -->

<!-- wp:spacer {"height":"5px"} -->
<div style="height:5px" aria-hidden="true" class="wp-block-spacer"></div>
<!-- /wp:spacer -->

<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->
<div class="wp-block-buttons">
    <!-- wp:button {"className":"is-style-fill"} -->
    <div class="wp-block-button is-style-fill">
        <a class="wp-block-button__link wp-element-button" href="<?php echo get_home_url(); ?>">
            <?php esc_html_e('Idi na naslovnu stranicu', 'azp'); ?>
        </a>
    </div>
    <!-- /wp:button -->
</div>
<!-- /wp:buttons -->
