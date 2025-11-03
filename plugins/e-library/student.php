<?php

class E_Library_Student
{
    private const IMPORT_STUDENTS_ACTION = 'import-students';
    public const USER_ROLE = 'student';
    public const STUDY_GROUPS_META_KEY = 'e-library__user_study_groups';

    public function __construct()
    {
        $role = add_role(self::USER_ROLE, __('Student', 'azp'), [
            'read' => true,
        ]);
        if (!$role) {
            $role = get_role(self::USER_ROLE);
            $role->has_cap('read') || $role->add_cap('read');
        }

        add_action('admin_menu', function () {
            add_submenu_page(
                'users.php',
                __('Import Students', 'azp'),
                __('Import Students', 'azp'),
                'edit_users',
                'import_students',
                [$this, 'import_students_page'],
            );
        });
    }

    public function is_current_user_student()
    {
        return current_user_can(self::USER_ROLE);
    }

    public function get_user_study_groups(int $user_id)
    {
        return array_map(
            'trim',
            explode(
                ',',
                get_user_meta($user_id, self::STUDY_GROUPS_META_KEY, true),
            ),
        );
    }

    public function get_current_user_study_groups()
    {
        if (!is_user_logged_in()) {
            return false;
        }
        return $this->get_user_study_groups(get_current_user_id());
    }

    /**
     * @return null|bool
     * - Returns `null` if it's not an import students action at all.
     * - Returns `true` if it's a verified import students action.
     * - Returns `false` if it's not a verified import students action, i.e. the nonce is invalid.
     */
    private function verify_import_students_action()
    {
        if (
            isset($_POST['action']) &&
            $_POST['action'] == self::IMPORT_STUDENTS_ACTION
        ) {
            return !!wp_verify_nonce(
                $_POST['_wpnonce'],
                self::IMPORT_STUDENTS_ACTION,
            );
        }
        return null;
    }

    public function import_students_page()
    {
        $imported_students = null;
        if ($this->verify_import_students_action() === true) {
            $imported_students = $this->import_students(
                $_FILES['file']['tmp_name'],
            );
        }
        ?>
<div class="wrap">
  <h1><?php _e('Import Students', 'azp'); ?></h1>
  <?php if ($imported_students === true) {
      wp_admin_notice(__('Students have been imported.', 'azp'), [
          'type' => 'success',
      ]);
  } elseif ($imported_students instanceof WP_Error) {
      wp_admin_notice(
          '<strong>' .
              __('Error:') .
              '</strong> ' .
              implode(', ', $imported_students->get_error_messages()),
          [
              'type' => 'error',
          ],
      );
  } ?>

  <p>
    <?php _e(
        'Upload a CSV file containing the students and their belonging library study groups to import.',
        'azp',
    ); ?>
  </p>
  <p>
    <?php _e(
        'The CSV contents will be synced, using the username as the identifier, with the users in the database; meaning, new users will be created, existing users will be updated, and users not in the CSV will be deleted.',
        'azp',
    ); ?>
  </p>
  <p>
    <?php _e(
        'E-Mails will also be sent to the users to notify them of their new or updated accounts.',
        'azp',
    ); ?>
  </p>

  <form
    id="<?php esc_attr_e(self::IMPORT_STUDENTS_ACTION); ?>"
    method="post"
    enctype="multipart/form-data"
  >
    <?php wp_nonce_field(self::IMPORT_STUDENTS_ACTION); ?>
		<input type="hidden" name="action" value="<?php esc_attr_e(
      self::IMPORT_STUDENTS_ACTION,
  ); ?>" />

    <table class="form-table">
      <tbody>
      <tr>
        <th>
          <label for="file">
            <?php _e('CSV file', 'azp'); ?>
          </label>
        </th>
        <td>
          <input id="file" name="file" type="file" accept="text/csv" required />
        </td>
      </tbody>
    </table>
    <p>
      <?php submit_button(__('Import'), 'primary'); ?>
    </p>
  </form>
</div>
    <?php
    }

    public function import_students(string $filename)
    {
        $handle = fopen($filename, 'r');

        $field_indexes = null;
        $students = [];
        while (($row = fgetcsv($handle)) !== false) {
            if (!$field_indexes) {
                $username_i = array_search('username', $row);
                $email_i = array_search('email', $row);
                $study_groups_i = array_search('study_groups', $row);
                if (
                    is_int($username_i) &&
                    is_int($email_i) &&
                    is_int($study_groups_i)
                ) {
                    $field_indexes = [
                        'username' => $username_i,
                        'email' => $email_i,
                        'study_groups' => $study_groups_i,
                    ];

                    $first_name_i = array_search('first_name', $row);
                    if (is_int($first_name_i)) {
                        $field_indexes['first_name'] = $first_name_i;
                    }

                    $last_name_i = array_search('last_name', $row);
                    if (is_int($last_name_i)) {
                        $field_indexes['last_name'] = $last_name_i;
                    }
                }
                continue;
            }
            $students[] = [
                'username' => sanitize_user(
                    $row[$field_indexes['username']],
                    true,
                ),
                'email' => trim((string) $row[$field_indexes['email']]),
                'study_groups' => array_map(
                    'trim',
                    explode(',', $row[$field_indexes['study_groups']]),
                ),
                'first_name' => $field_indexes['first_name']
                    ? trim((string) $row[$field_indexes['first_name']])
                    : null,
                'last_name' => $field_indexes['last_name']
                    ? trim((string) $row[$field_indexes['last_name']])
                    : null,
            ];
        }
        fclose($handle);

        if (empty($field_indexes)) {
            return new WP_Error(
                'no_header',
                __('No header found in the CSV file.', 'azp'),
            );
        }

        if (empty($students)) {
            return new WP_Error(
                'no_students',
                __('No students found in the CSV file.', 'azp'),
            );
        }

        global $wpdb;
        $wpdb->query('START TRANSACTION');

        $mails = [];
        $errors = new WP_Error();
        foreach ($students as $student) {
            $existing_student = get_user_by('login', $student['username']);
            if ($existing_student) {
                if (!user_can($existing_student, self::USER_ROLE)) {
                    // existing non-student users cannot be downgraded
                    $errors->add(
                        'existing_user_not_student',
                        sprintf(
                            __(
                                'Existing user <strong>%s</strong> is not a student.',
                                'azp',
                            ),
                            $existing_student->user_login,
                        ),
                    );
                    continue;
                }

                $existing_student->user_email = $student['email'];
                $existing_student->first_name = $student['first_name'];
                $existing_student->last_name = $student['last_name'];

                $updated_user_id = wp_update_user($existing_student);
                if ($updated_user_id instanceof WP_Error) {
                    $updated_user_id->add_data([
                        'username' => $student['username'],
                    ]);
                    $errors->merge_from($updated_user_id);
                }

                if (
                    $this->get_user_study_groups($existing_student->ID) !=
                        $student['study_groups'] &&
                    update_user_meta(
                        $existing_student->ID,
                        self::STUDY_GROUPS_META_KEY,
                        implode(',', $student['study_groups']),
                    ) !== true
                ) {
                    $errors->add(
                        'failed_update_user_meta',
                        sprintf(
                            __(
                                'Failed to update study groups for user <strong>%s</strong>.',
                                'azp',
                            ),
                            $existing_student->user_login,
                        ),
                    );
                }

                // TODO: send email about changes

                continue;
            }

            $password = wp_generate_password(16, false);
            $new_student_id = wp_insert_user([
                'user_pass' => $password,
                'user_login' => $student['username'],
                'user_email' => $student['email'],
                'first_name' => $student['first_name'],
                'last_name' => $student['last_name'],
                'role' => self::USER_ROLE,
                'meta_input' => [
                    self::STUDY_GROUPS_META_KEY => implode(
                        ',',
                        $student['study_groups'],
                    ),
                ],
            ]);
            if ($new_student_id instanceof WP_Error) {
                $new_student_id->add_data(['username' => $student['username']]);
                $errors->merge_from($new_student_id);
                continue;
            }

            $reset_password_key = get_password_reset_key(
                get_user($new_student_id),
            );
            $reset_password_url = network_site_url(
                "wp-login.php?action=rp&key=$reset_password_key&login=" .
                    rawurlencode($student['username']),
                'login',
            );

            $mails[] = [
                'to' => $student['email'],
                'subject' => 'Biblioteka - Akademija za psihoterapiju',
                'message' => sprintf(
                    'Poštovani,<br><br>
Dobro došli u elektronsku biblioteku Akademije za psihoterapiju!<br><br>
Vaše korisničko ime je: <b>%s</b><br>
<a href="%s">Kliknite ovdje kako biste podesili Vašu šifru.</a><br><br>
Srdačan pozdrav,<br>
Akademija za psihoterapiju',
                    $student['username'],
                    $reset_password_url,
                ),
            ];

            // TODO: send email to new student
        }
        // TODO: delete users not in the csv
        if ($errors->has_errors()) {
            $wpdb->query('ROLLBACK');
            return $errors;
        } else {
            $wpdb->query('COMMIT');
        }

        foreach ($mails as $mail) {
            if (
                !wp_mail($mail['to'], $mail['subject'], $mail['message'], [
                    'Content-Type: text/html; charset=UTF-8',
                ])
            ) {
                $errors->add(
                    'failed_mail',
                    __(
                        sprintf(
                            'Failed to send email to <b>%s</b>.',
                            $mail['to'],
                        ),
                        'azp',
                    ),
                );
            }
        }

        /** @phpstan-var bool $hasErrors */
        $hasErrors = $errors->has_errors();
        if ($hasErrors) {
            return $errors;
        }

        return true;
    }
}
