FROM php:8.2-fpm

# 1. Dépendances système (avec libpq-dev corrigé)
RUN apt-get update && apt-get install -y \
    git unzip libzip-dev libpng-dev libonig-dev libxml2-dev libicu-dev \
    libpq-dev \
    libz-dev \
    nginx supervisor \
    && docker-php-ext-configure intl \
    && docker-php-ext-install pdo_mysql pdo_pgsql mbstring zip exif pcntl bcmath intl gd \
    && pecl install redis-6.2.0 \
    && docker-php-ext-enable redis \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 2. Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# 3. Cache libs
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist

# 4. Code & Permissions
COPY --chown=www-data:www-data . .

RUN mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R ug+rwX storage bootstrap/cache \
    && composer dump-autoload --optimize

# 5. Nettoyage Nginx (pour laisser start.sh configurer le port)
RUN rm -f /etc/nginx/sites-enabled/default

# 6. Config Supervisor
RUN printf '%s\n' \
  '[supervisord]' \
  'nodaemon=true' \
  'user=root' \
  '' \
  '[program:php-fpm]' \
  'command=php-fpm -F' \
  'autorestart=true' \
  'stdout_logfile=/dev/stdout' \
  'stdout_logfile_maxbytes=0' \
  'stderr_logfile=/dev/stderr' \
  'stderr_logfile_maxbytes=0' \
  '' \
  '[program:nginx]' \
  'command=nginx -g "daemon off;"' \
  'autorestart=true' \
  'stdout_logfile=/dev/stdout' \
  'stdout_logfile_maxbytes=0' \
  'stderr_logfile=/dev/stderr' \
  'stderr_logfile_maxbytes=0' \
  > /etc/supervisor/conf.d/supervisord.conf

RUN chmod +x /var/www/html/start.sh

EXPOSE 8080

CMD ["/var/www/html/start.sh"]
