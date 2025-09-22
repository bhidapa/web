FROM wordpress:6.8 AS wp

# dunglas/frankenphp:<frankenphp-version>-php<php-version>-<os>
FROM dunglas/frankenphp:1.9-php8.4-trixie

# install system dependencies for proper use (see https://github.com/StephenMiracle/frankenwp/blob/e05bcc3d951dc57636c87befa63357ec1350006d/Dockerfile#L45-L60)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ghostscript \
    curl \
    less \
    libonig-dev \
    libxml2-dev \
    libcurl4-openssl-dev \
    libssl-dev \
    libzip-dev \
    unzip \
    git \
    libjpeg-dev \
    libwebp-dev \
    libzip-dev \
    libmemcached-dev \
    vim \
    zlib1g-dev \
    sendmail

# install the PHP extensions we need (https://make.wordpress.org/hosting/handbook/handbook/server-environment/#php-extensions)
RUN install-php-extensions \
    bcmath \
    exif \
    gd \
    intl \
    mysqli \
    zip \
    imagick \
    opcache

# install wp-cli
RUN curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && \
    chmod +x wp-cli.phar && \
    mv wp-cli.phar /usr/local/bin/wp

# install wordpress
COPY --from=wp /usr/src/wordpress /usr/src/wordpress
COPY --from=wp /usr/local/etc/php/conf.d /usr/local/etc/php/conf.d/
COPY --from=wp /usr/local/bin/docker-entrypoint.sh /usr/local/bin/

# use frankenphp instead of php-fpm
RUN sed -i \
    -e 's/\[ "$1" = '\''php-fpm'\'' \]/\[\[ "$1" == frankenphp* \]\]/g' \
    -e 's/php-fpm/frankenphp/g' \
    /usr/local/bin/docker-entrypoint.sh

# caddy and wordpress permissions using the conventional www-data
RUN chown -R www-data:www-data /data/caddy && \
    chown -R www-data:www-data /config/caddy && \
    chown -R www-data:www-data /var/www/html && \
    chown -R www-data:www-data /usr/src/wordpress && \
    chown -R www-data:www-data /usr/local/bin/docker-entrypoint.sh

COPY custom.ini /usr/local/etc/php/conf.d/

COPY Caddyfile /etc/caddy/

WORKDIR /var/www/html

USER www-data
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["frankenphp", "run", "--config", "/etc/caddy/Caddyfile"]
