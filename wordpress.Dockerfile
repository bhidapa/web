FROM wordpress:6.4

# custom php settings
COPY custom.ini $PHP_INI_DIR/conf.d/

# install wp-cli
RUN curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && \
  chmod +x wp-cli.phar && \
  mv wp-cli.phar /usr/local/bin/wp
