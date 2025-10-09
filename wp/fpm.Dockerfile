FROM wordpress:6.8-php8.3-fpm

# Install fcgi for healthcheck
RUN apt-get update && apt-get install -y libfcgi-bin

# Clean up
RUN apt-get clean && apt-get autoremove --purge && rm -rf /var/lib/apt/lists/*

COPY fpm.conf /usr/local/etc/php-fpm.d/zz-www.conf
COPY custom.ini /usr/local/etc/php/conf.d/
