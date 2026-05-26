FROM php:8.2-fpm

# ─── 1. install-php-extensions (COPY --from, plus fiable que ADD URL) ─────────
# Copie depuis l'image officielle plutôt que de télécharger via HTTPS.
# Évite les problèmes de réseau, BuildKit, permissions et fichiers corrompus.
COPY --from=mlocati/php-extension-installer:latest \
    /usr/bin/install-php-extensions \
    /usr/local/bin/

# ─── 2. Outils système ────────────────────────────────────────────────────────
# On installe uniquement git/unzip/nginx/supervisor.
# install-php-extensions gère lui-même toutes les libs C nécessaires (libpng,
# libjpeg, libpq, libicu, etc.) selon la version Debian de l'image.
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    unzip \
    nginx \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# ─── 3. Extensions PHP (hors redis) ─────────────────────────────────────────
RUN install-php-extensions \
    pdo_mysql \
    pdo_pgsql \
    mbstring \
    zip \
    exif \
    pcntl \
    bcmath \
    intl \
    gd

# ─── 4. Redis — installé depuis GitHub pour éviter pecl.php.net (souvent down) ─
# pecl.php.net retourne des 502/503 de façon intermittente en CI.
# GitHub releases est beaucoup plus fiable.
RUN curl -fsSL https://github.com/phpredis/phpredis/archive/refs/tags/6.1.0.tar.gz \
        | tar xz -C /tmp \
    && cd /tmp/phpredis-6.1.0 \
    && phpize \
    && ./configure \
    && make -j"$(nproc)" \
    && make install \
    && docker-php-ext-enable redis \
    && rm -rf /tmp/phpredis-6.1.0

# ─── 5. Composer ──────────────────────────────────────────────────────────────
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# ─── 6. Dépendances Composer (layer mis en cache) ─────────────────────────────
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist

# ─── 7. Code applicatif ───────────────────────────────────────────────────────
COPY --chown=www-data:www-data . .

RUN mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R ug+rwX storage bootstrap/cache \
    && composer dump-autoload --optimize

# ─── 8. Nginx ─────────────────────────────────────────────────────────────────
RUN rm -f /etc/nginx/sites-enabled/default

# ─── 9. Supervisor ────────────────────────────────────────────────────────────
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
