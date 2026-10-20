#!/usr/bin/env sh
set -eu

PORT_VALUE="${PORT:-8080}"

echo "[start.sh] === SmartQueue Backend Starting ==="
echo "[start.sh] PORT=${PORT_VALUE}"
echo "[start.sh] APP_ENV=${APP_ENV:-production}"

# ─── 1. Vider les anciens caches (buitlds sans les vraies variables d'env) ────
echo "[start.sh] Clearing stale caches..."
php artisan config:clear  --quiet 2>/dev/null || true
php artisan route:clear   --quiet 2>/dev/null || true
php artisan view:clear    --quiet 2>/dev/null || true
php artisan event:clear   --quiet 2>/dev/null || true

# ─── 2. Reconstruire les caches avec les VRAIES variables de production ───────
echo "[start.sh] Rebuilding caches with production env..."
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

# ─── 3. Symlink storage → public/storage ─────────────────────────────────────
php artisan storage:link --quiet 2>/dev/null || true

# ─── 4. Migrations (toujours exécutées par défaut, désactivables via RUN_MIGRATIONS=false) ─
# php artisan migrate --force est idempotent : aucun risque si tout est déjà à jour.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[start.sh] Running migrations..."
  php artisan migrate --force
fi

# ─── 5. Config Nginx dynamique (écoute sur le PORT donné par Railway) ─────────
cat > /etc/nginx/conf.d/default.conf <<EOF
server {
    listen 0.0.0.0:${PORT_VALUE};
    server_name _;
    root /var/www/html/public;
    index index.php;

    # Gzip
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;

    # Routes Laravel
    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    # PHP-FPM
    location ~ \.php$ {
        fastcgi_pass        127.0.0.1:9000;
        fastcgi_index       index.php;
        include             fastcgi_params;
        fastcgi_param       SCRIPT_FILENAME \$realpath_root\$fastcgi_script_name;
        fastcgi_param       DOCUMENT_ROOT   \$realpath_root;
        fastcgi_read_timeout 60;
        fastcgi_hide_header X-Powered-By;
    }

    # Bloquer l'accès aux fichiers cachés (.env, .git, etc.)
    location ~ /\.(?!well-known).* {
        deny all;
    }

    client_max_body_size 20M;
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
}
EOF

echo "[start.sh] Nginx config written for port ${PORT_VALUE}"

# ─── 6. Worker de queue + scheduler ──────────────────────────────────────────
# Indispensables au fonctionnement de la file : expiration des appels / "en route",
# activation des tickets reportés, clôture de journée (scheduler) et envoi des
# notifications push/SMS + in-app (jobs en queue). Désactivables si ces processus
# tournent dans des services séparés (RUN_QUEUE_WORKER=false / RUN_SCHEDULER=false).
SUPERVISOR_CONF=/etc/supervisor/conf.d/supervisord.conf

if [ "${RUN_QUEUE_WORKER:-true}" = "true" ] && ! grep -q "program:queue-worker" "$SUPERVISOR_CONF"; then
  cat >> "$SUPERVISOR_CONF" <<EOF

[program:queue-worker]
command=php /var/www/html/artisan queue:work --sleep=3 --tries=3 --timeout=90 --max-time=3600
user=www-data
autorestart=true
stopwaitsecs=100
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
EOF
  echo "[start.sh] Queue worker enabled"
fi

if [ "${RUN_SCHEDULER:-true}" = "true" ] && ! grep -q "program:scheduler" "$SUPERVISOR_CONF"; then
  cat >> "$SUPERVISOR_CONF" <<EOF

[program:scheduler]
command=php /var/www/html/artisan schedule:work
user=www-data
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
EOF
  echo "[start.sh] Scheduler enabled"
fi

# Les commandes artisan ci-dessus tournent en root : rendre storage/ et le cache
# accessibles en écriture à php-fpm et aux workers (www-data), sinon un
# laravel.log créé par root provoque des erreurs 500 à la première écriture.
mkdir -p storage/logs storage/app/public storage/framework/cache storage/framework/sessions storage/framework/views
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true

echo "[start.sh] Starting supervisord (php-fpm + nginx + workers)..."

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
