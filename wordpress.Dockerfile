FROM wordpress:6.4
COPY custom.ini $PHP_INI_DIR/conf.d/
