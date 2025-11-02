<?php
/**
 * Plugin Name: E-Library
 * Author:      BHIDAPA
 * Author URI:  https://bhidapa.ba/
 * Description: A simple e-library plugin for managing access to protected resources.
 * Version:     0.0.0
 */

require_once 'student.php';

add_action('init', function () {
    global $e_library;
    $e_library = new E_Library();
    register_block_type(
        dirname(__FILE__) . '/blocks/e-library/build/block.json',
    );
    register_block_type(
        dirname(__FILE__) . '/blocks/has-access/build/block.json',
    );
    register_block_type(
        dirname(__FILE__) . '/blocks/no-access/build/block.json',
    );
});

class E_Library
{
    private const HIGH_HOOK_PRIORITY = 15; // 10 being the default

    private const LITERATURE_POST_TYPE = 'literatura';
    private const STUDY_GROUP_TAXONOMY = 'studijska-grupa';

    public function __construct()
    {
        add_action('show_user_profile', [$this, 'add_user_meta_fields']);
        add_action('edit_user_profile', [$this, 'add_user_meta_fields']);
        add_action('user_new_form', [$this, 'add_user_meta_fields']);

        add_action('personal_options_update', [$this, 'update_user_meta']);
        add_action('edit_user_profile_update', [$this, 'update_user_meta']);
        add_action('user_register', [$this, 'update_user_meta']);

        add_filter(
            'template_redirect',
            [$this, 'template_redirect'],
            self::HIGH_HOOK_PRIORITY,
        );
        add_filter(
            'pre_get_block_templates',
            [$this, 'pre_get_block_templates'],
            self::HIGH_HOOK_PRIORITY,
        );
        add_filter(
            'rest_prepare_' . self::LITERATURE_POST_TYPE,
            [$this, 'rest_prepare_literature_post_type'],
            self::HIGH_HOOK_PRIORITY,
        );
        add_filter(
            'pre_get_posts',
            [$this, 'pre_get_posts'],
            self::HIGH_HOOK_PRIORITY,
        );
    }

    /** @return false|array<string> */
    private function get_the_post_study_groups()
    {
        $the_id = get_the_ID();
        if (!$the_id) {
            return false;
        }
        $study_groups = get_the_terms(get_the_ID(), self::STUDY_GROUP_TAXONOMY);
        if (!$study_groups) {
            return [];
        }
        return array_map(function (WP_Term $term) {
            return $term->slug;
        }, $study_groups);
    }

    /**
     * TODO: cache the result so that the method can be used multiple
     *       times on the same page without affecting the performance
     */
    public function has_current_user_access_to_the_study_group()
    {
        global $e_library_student;

        if (!is_user_logged_in()) {
            // user is not logged in, unauthenticated users have no access at all
            return false;
        }

        if (!$e_library_student->is_current_user_student()) {
            // user is not a student, current users having access to private posts or pages can access the library
            return current_user_can('read_private_pages') ||
                current_user_can('read_private_posts');
        }

        $post_study_groups = $this->get_the_post_study_groups();
        if (empty($post_study_groups)) {
            // not a post page or it does not belong to any study
            // group, probably the literature - all students have access
            return true;
        }

        $user_study_groups = $e_library_student->get_current_user_study_groups();
        foreach ($post_study_groups as $post_study_group) {
            if (in_array($post_study_group, $user_study_groups)) {
                // student has access to the post's study group
                return true;
            }
        }

        return false;
    }

    /**
     * TODO: cache the result so that the method can be used multiple
     *       times on the same page without affecting the performance
     */
    public function has_current_user_access_to_the_page()
    {
        global $e_library_student;

        if (is_single()) {
            // a single post page

            $post_type = get_post_type();
            if ($post_type !== self::LITERATURE_POST_TYPE) {
                // not e-library post
                return true;
            }

            // is an e-library post

            return $e_library_student->is_current_user_student() ||
                current_user_can('read_private_pages') ||
                current_user_can('read_private_posts');
        }

        if (is_tax()) {
            /** @var WP_Term */
            $term = get_queried_object();
            $tax = get_taxonomy($term->taxonomy);
            if (!in_array(self::LITERATURE_POST_TYPE, $tax->object_type)) {
                // not a term archive page of the e-library
                return true;
            }

            // is a term archive page of the e-library

            return $e_library_student->is_current_user_student() ||
                current_user_can('read_private_pages') ||
                current_user_can('read_private_posts');
        }

        // otherwise has access

        return true;
    }

    public function add_user_meta_fields(string|WP_User $user)
    {
        if (!current_user_can('edit_users')) {
            // only admins can edit students study groups
            return;
        } ?>
<h2><?php _e('Library', 'azp'); ?></h2>
<table class="form-table">
    <tr>
        <th>
            <label for="<?php echo esc_attr(
                E_Library_Student::STUDY_GROUPS_META_KEY,
            ); ?>">
                <?php _e('Study groups', 'azp'); ?>
            </label>
        </th>
        <td>
            <input
            type="text"
            class="regular-text"
            id="<?php echo esc_attr(
                E_Library_Student::STUDY_GROUPS_META_KEY,
            ); ?>"
            name="<?php echo esc_attr(
                E_Library_Student::STUDY_GROUPS_META_KEY,
            ); ?>"
            value="<?php echo $user instanceof WP_User
                ? esc_attr(
                    get_user_meta(
                        $user->ID,
                        E_Library_Student::STUDY_GROUPS_META_KEY,
                        true,
                    ),
                )
                : ''; ?>"
            >
            <p class="description">
            <?php _e(
                'Comma separated study group slugs to which the student belongs.',
                'azp',
            ); ?>
            </p>
        </td>
    </tr>
</table>
        <?php
    }

    public function update_user_meta(int $user_id)
    {
        if (
            current_user_can('edit_user', $user_id) &&
            isset($_REQUEST[E_Library_Student::STUDY_GROUPS_META_KEY])
        ) {
            // TODO: make sure the user meta update is coming from the edit user admin page (and not from the backend php call like update_user_meta)
            // TODO: validate input is proper before saving
            update_user_meta(
                $user_id,
                E_Library_Student::STUDY_GROUPS_META_KEY,
                $_REQUEST[E_Library_Student::STUDY_GROUPS_META_KEY],
            );
        }
    }

    public function rest_prepare_literature_post_type(
        WP_REST_Response $response,
    ) {
        global $e_library_student;
        if (
            !$e_library_student->is_current_user_student() &&
            !current_user_can('read_private_pages') &&
            !current_user_can('read_private_posts')
        ) {
            // e-library, even over rest, can only be accessed by authorised users
            return rest_convert_error_to_response(
                new WP_Error(
                    'rest_forbidden',
                    __('Sorry, you are not allowed to do that.'),
                    [
                        'status' => 401,
                    ],
                ),
            );
        }
        return $response;
    }

    public function template_redirect()
    {
        if (!$this->has_current_user_access_to_the_page()) {
            status_header(401);

            // TODO: this header should be present always on the protected pages, not only if
            //       unauthenticated. however, it is ok this way because only crawlers look for
            //       this header (and they're always unauthenticated)
            header('X-Robots-Tag: none');
        }
    }

    public function pre_get_block_templates()
    {
        if (!$this->has_current_user_access_to_the_page()) {
            $block_template = get_block_template(
                'azp//e-library-unauthorized',
                'wp_template',
            );
            return [$block_template];
        }
    }

    public function pre_get_posts(WP_Query $query)
    {
        if (is_admin()) {
            // no filters on admin pages ever
            return;
        }

        if (!$query->is_main_query()) {
            // we only care about main queries, like search results or archives
            return;
        }

        if ($query->is_singular()) {
            // querying posts on a single page is allowed, the template_redirect will handle it
            return;
        }

        global $e_library_student;
        if (
            $e_library_student->is_current_user_student() ||
            current_user_can('read_private_pages') ||
            current_user_can('read_private_posts')
        ) {
            // students and users having access to private pages or post can access the library
            return;
        }

        // get all post types that are searchable (that includes the e-library, will be filtered later on)
        $searchable_post_types = array_keys(
            get_post_types([
                'exclude_from_search' => false,
            ]),
        );

        // extract queried post types and make sure it's always an array
        $queried_post_types = $query->get('post_type');
        if (empty($queried_post_types)) {
            // if the queried post types are empty, search all searchable post types (including the e-library, will be filtered later)
            $queried_post_types = $searchable_post_types;
        } elseif (is_string($queried_post_types)) {
            $queried_post_types = [$queried_post_types];
        }

        // filter out e-library from queried post types
        $queried_post_types = array_filter($queried_post_types, function (
            string $post_type,
        ) {
            return $post_type !== self::LITERATURE_POST_TYPE;
        });
        if (empty($queried_post_types)) {
            // queried post types are empty, meaning that all restricted types are omitted
            // hence we query a non-existant post type to show the user "no results"
            $queried_post_types = ['LITERATURE_POST_TYPES_ALLOWED'];
        }
        $query->set('post_type', $queried_post_types);
    }
}
