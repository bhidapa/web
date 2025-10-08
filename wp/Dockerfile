FROM wordpress:6.8-php8.3-apache

# Install new certificats and development tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    vim

# Install wp-cli
RUN curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && \
    chmod +x wp-cli.phar && \
    mv wp-cli.phar /usr/local/bin/wp

# Clean up apt cache
RUN apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set recommended PHP.ini settings
# https://wordpress.org/support/article/editing-wp-config-php/#configure-error-logging
RUN { \
    echo 'error_reporting = E_ERROR | E_WARNING | E_PARSE | E_CORE_ERROR | E_CORE_WARNING | E_COMPILE_ERROR | E_COMPILE_WARNING | E_RECOVERABLE_ERROR'; \
    echo 'display_errors = Off'; \
    echo 'display_startup_errors = Off'; \
    echo 'log_errors = On'; \
    echo 'error_log = /dev/stderr'; \
    echo 'log_errors_max_len = 1024'; \
    echo 'ignore_repeated_errors = On'; \
    echo 'ignore_repeated_source = Off'; \
    echo 'html_errors = Off'; \
    } > $PHP_INI_DIR/conf.d/error-logging.ini

# Copy custom PHP configuration
COPY custom.ini $PHP_INI_DIR/conf.d/

WORKDIR /var/www/html

# The official WordPress image already has the proper entrypoint, user and cmd set
