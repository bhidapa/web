ARG WORDPRESS_VERSION=6.8
ARG PHP_VERSION=8.3

FROM wordpress:${WORDPRESS_VERSION}-php${PHP_VERSION}-fpm

# Install fcgi for healthcheck
RUN apt-get update && apt-get install -y libfcgi-bin

# Create a simple healthcheck script (we cant use WordPress index.php because it needs many params)
RUN echo '<?php http_response_code(200); ?>' > /opt/healthcheck.php

# Clean up
RUN apt-get clean && apt-get autoremove --purge && rm -rf /var/lib/apt/lists/*

COPY fpm.conf /usr/local/etc/php-fpm.d/zz-www.conf
COPY custom.ini /usr/local/etc/php/conf.d/
