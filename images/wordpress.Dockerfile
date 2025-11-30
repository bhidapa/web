FROM wordpress:6.8

# custom php settings
COPY custom.ini $PHP_INI_DIR/conf.d/

# install wp-cli
RUN curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && \
  chmod +x wp-cli.phar && \
  mv wp-cli.phar /usr/local/bin/wp

# install dev tools
RUN apt-get update && apt-get install -y less vim htop wget curl

# set Apache LimitRequestBody to 5GB
RUN echo "LimitRequestBody 5368709120" >> /etc/apache2/apache2.conf
