<?php
/**
 * Register and set up E-Library. Needs the plugin to be activated first.
 */
add_action('init', function () {
    if (function_exists('e_library_setup')) {
        e_library_setup('bhd//e-library-unauthorized', 'grupa-strucnjaka');
    }
});

add_filter('e_library_student_import_email_subject', function () {
    return 'Biblioteka - BHIDAPA';
});

add_filter(
    'e_library_student_import_email_message',
    function (
        string $message,
        array $student,
        string $reset_password_url,
    ): string {
        return sprintf(
            'Poštovani,<br><br>
Dobro došli u elektronsku biblioteku BHIDAPA!<br><br>
Vaše korisničko ime je: <b>%s</b><br>
<a href="%s">Kliknite ovdje kako biste podesili Vašu šifru.</a><br><br>
Srdačan pozdrav,<br>
BHIDAPA',
            $student['username'],
            $reset_password_url,
        );
    },
    10,
    3,
);
