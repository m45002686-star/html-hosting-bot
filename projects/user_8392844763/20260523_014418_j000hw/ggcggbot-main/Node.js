#!/bin/bash
set -e

echo "=== JassimHost Bot Hosting Installer ==="

# 1. تحديث وتثبيت Docker
apt update && apt upgrade -y
apt install -y ca-certificates curl gnupg lsb-release git
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

systemctl enable docker
systemctl start docker

# 2. إنشاء مجلد المشروع
mkdir -p /home/hosting/pterodactyl/{var,nginx,certbot}
cd /home/hosting/pterodactyl

# 3. إنشاء docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  panel:
    image: ghcr.io/pterodactyl/panel:latest
    container_name: pterodactyl_panel
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./var:/app/var
      - ./nginx:/etc/nginx/conf.d
      - ./certbot:/etc/letsencrypt
    environment:
      APP_URL: http://localhost
      APP_TIMEZONE: Asia/Riyadh
    depends_on:
      - mysql
      - redis

  wings:
    image: ghcr.io/pterodactyl/wings:latest
    container_name: pterodactyl_wings
    restart: always
    privileged: true
    ports:
      - "8080:8080"
      - "2022:2022"
    volumes:
      - /var/lib/pterodactyl:/var/lib/pterodactyl
      - /var/log/pterodactyl:/var/log/pterodactyl
      - /etc/pterodactyl:/etc/pterodactyl
    environment:
      WINGS_CONFIG: /etc/pterodactyl/config.yml

  mysql:
    image: mysql:8.0
    container_name: pterodactyl_mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: RootPass123!
      MYSQL_DATABASE: panel
      MYSQL_USER: pterodactyl
      MYSQL_PASSWORD: PanelPass123!
    volumes:
      - mysql_data:/var/lib/mysql

  redis:
    image: redis:alpine
    container_name: pterodactyl_redis
    restart: always

volumes:
  mysql_data:
EOF

# 4. إنشاء nginx config
cat > nginx/panel.conf << 'EOF'
server {
    listen 80;
    server_name _;
    root /app/public;
    index.php index.html;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/run/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
EOF

# 5. تفعيل Swap 8GB للأداء
if ! swapon --show | grep -q swapfile; then
  fallocate -l 8G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "Swap 8GB enabled"
fi

# 6. تشغيل الحاويات
docker compose up -d

echo ""
echo "=== تم التثبيت! ==="
echo "اللوحة: http://$(curl -s ifconfig.me)"
echo "انتظر 2-3 دقايق لين تكتمل"
echo ""
echo "لإنشاء حساب الأدمن شغّل:"
echo "docker exec -it pterodactyl_panel php artisan p:user:make"
echo ""
echo "بعدين ارجع لي أعطيك أوامر ربط الـ Node وتركيب SSL"