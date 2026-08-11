#!/usr/bin/env bash
#
# One-time TLS setup for the social-app API. Run this ON THE EC2 INSTANCE, from
# the deploy directory, once:
#
#   cd ~/social-app/backend        # wherever EC2_DEPLOY_PATH points
#   EMAIL=you@example.com ./scripts/setup-nginx-tls.sh
#
# It installs nginx + certbot from apt, drops in the site config, and lets
# `certbot --nginx` obtain the certificate and rewrite the config with the TLS
# block and redirect. Renewal is handled from then on by the certbot systemd
# timer that the package installs — there is nothing further to schedule.
#
# Safe to re-run: every step is idempotent, and certbot will not re-issue a
# certificate that is still far from expiry unless you pass --force-renewal.

set -euo pipefail

DOMAIN="${DOMAIN:-socialappfomo.duckdns.org}"
EMAIL="${EMAIL:-}"
APP_PORT="${APP_PORT:-8000}"
STAGING="${STAGING:-0}"

SITE_SRC="deploy/nginx/social-app.conf"
SITE_DST="/etc/nginx/sites-available/social-app"

if [ -z "$EMAIL" ]; then
  echo "ERROR: set EMAIL — Let's Encrypt uses it for expiry warnings." >&2
  echo "  EMAIL=you@example.com $0" >&2
  exit 1
fi

if [ ! -f "$SITE_SRC" ]; then
  echo "ERROR: $SITE_SRC not found. Run this from the deploy directory" >&2
  echo "       (the one holding docker-compose.yml)." >&2
  exit 1
fi

echo "==> [1/7] Checking $DOMAIN points at this instance"
resolved="$(getent hosts "$DOMAIN" | awk '{print $1}' | head -n1 || true)"
# EXPECT_IP is an escape hatch for hosts that cannot reach the metadata service.
public_ip="${EXPECT_IP:-$(curl -fsS -m 5 https://checkip.amazonaws.com | tr -d '[:space:]' || true)}"
echo "    $DOMAIN -> ${resolved:-<unresolved>}"
echo "    this instance -> ${public_ip:-<unknown>}"
if [ -z "$resolved" ]; then
  echo "ERROR: $DOMAIN does not resolve. Create the subdomain at duckdns.org" >&2
  echo "       and point it at this instance's Elastic IP first." >&2
  exit 1
fi
if [ -z "$public_ip" ]; then
  # Treated as fatal rather than skipped. If this check is simply bypassed when
  # the lookup fails, the script happily continues on whatever machine invoked
  # it — including a laptop — and step 3 starts installing nginx there.
  echo "ERROR: could not determine this machine's public IP, so there is no way" >&2
  echo "       to confirm it is the host $DOMAIN points at. Refusing to continue." >&2
  echo "       Check outbound connectivity, or set EXPECT_IP=<this host's IP> to" >&2
  echo "       assert it explicitly." >&2
  exit 1
fi
if [ "$resolved" != "$public_ip" ]; then
  echo "ERROR: $DOMAIN resolves to $resolved but this machine is $public_ip." >&2
  echo "       The ACME challenge would be served by another host and fail — and" >&2
  echo "       Let's Encrypt allows only 5 failed validations per hour." >&2
  echo "       Are you running this on the EC2 instance? Fix DNS, or run it there." >&2
  exit 1
fi
echo "    OK — DNS points at this machine"

echo "==> [2/7] Checking the API is listening on 127.0.0.1:$APP_PORT"
if ! curl -fsS -m 5 "http://127.0.0.1:$APP_PORT/health" >/dev/null 2>&1; then
  echo "ERROR: nothing answering on 127.0.0.1:$APP_PORT." >&2
  echo "       Start the stack first:" >&2
  echo "         docker compose up -d" >&2
  echo "       nginx would otherwise proxy to a dead port and every request 502s." >&2
  exit 1
fi
echo "    OK — API responding on the loopback interface"

echo "==> [3/7] Installing nginx and certbot"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  nginx certbot python3-certbot-nginx

echo "==> [4/7] Installing the site config"
if [ -f "$SITE_DST" ] && sudo grep -q "ssl_certificate" "$SITE_DST"; then
  # certbot has already rewritten the live config with the TLS block. Copying
  # the pre-TLS template over it would delete that and break HTTPS.
  echo "    $SITE_DST already has a TLS block — leaving it alone."
  echo "    (Delete it by hand first if you really want to start over.)"
else
  sudo cp "$SITE_SRC" "$SITE_DST"
  sudo ln -sf "$SITE_DST" /etc/nginx/sites-enabled/social-app
  # Ubuntu's stock site also claims `default_server` on :80; nginx refuses to
  # start with two of them.
  sudo rm -f /etc/nginx/sites-enabled/default
  echo "    installed $SITE_DST"
fi

sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
echo "    nginx running and serving on :80"

if [ "$STAGING" != "0" ]; then
  echo "==> [5/7] STAGING rehearsal against the test CA"
  # `certonly` rather than the full installer: this proves out DNS, port 80,
  # nginx and the ACME challenge without writing a TLS block into the config.
  #
  # The cert is then deleted. That matters — a staging certificate left behind
  # would make the later production run a *renewal* of a lineage pinned to the
  # test CA rather than a clean first issuance, and certbot will not silently
  # switch ACME servers. Removing it keeps the real run straightforward.
  sudo certbot certonly --nginx --staging \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    --force-renewal
  echo "    rehearsal succeeded — removing the untrusted staging certificate"
  sudo certbot delete --cert-name "$DOMAIN" --non-interactive

  cat <<EOF

Staging run complete. Nothing is serving HTTPS yet by design — this only
verified that DNS, port 80 and the ACME challenge all work.

Re-run without STAGING (or with the 'staging' box unchecked in the Actions UI)
to obtain the real certificate and enable HTTPS.
EOF
  exit 0
fi

echo "==> [5/7] Obtaining the certificate"
# --redirect makes certbot convert the :80 block into a 301 to https.
# --nginx edits the config and reloads nginx itself.
sudo certbot --nginx \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --redirect \
  --non-interactive

echo "==> [6/7] Enabling HTTP/2"
# certbot writes a plain `listen 443 ssl;` and never enables HTTP/2, so without
# this the site negotiates HTTP/1.1. Idempotent — safe on re-runs.
if sudo grep -qE 'http2 on;|listen 443 ssl http2' "$SITE_DST"; then
  echo "    already enabled"
else
  sudo cp "$SITE_DST" "$SITE_DST.bak-http2"
  ngx_ver="$(nginx -v 2>&1 | grep -oE '[0-9]+(\.[0-9]+)+' | head -1)"
  # The directive changed in 1.25.1: before that HTTP/2 is a `listen` parameter,
  # after it a standalone `http2` directive (and the listen parameter is
  # deprecated). Ubuntu 22.04 ships 1.18, 24.04 ships 1.24 — both legacy.
  if [ -n "$ngx_ver" ] && \
     [ "$(printf '%s\n1.25.1\n' "$ngx_ver" | sort -V | head -1)" = "1.25.1" ]; then
    sudo sed -i 's/^\([[:space:]]*\)\(listen 443 ssl;.*\)$/\1\2\n\1http2 on;/' "$SITE_DST"
  else
    sudo sed -i 's/^\([[:space:]]*listen 443 ssl\);/\1 http2;/' "$SITE_DST"
  fi

  if sudo nginx -t >/dev/null 2>&1; then
    sudo systemctl reload nginx
    sudo rm -f "$SITE_DST.bak-http2"
    echo "    enabled (nginx ${ngx_ver:-unknown})"
  else
    # Never leave the box with a config that will not load — a later reboot or
    # certbot renewal reload would then take the site down.
    echo "    WARNING: HTTP/2 edit did not validate, reverting. Site stays on" >&2
    echo "    HTTP/1.1, which is functionally fine." >&2
    sudo mv "$SITE_DST.bak-http2" "$SITE_DST"
    sudo nginx -t && sudo systemctl reload nginx
  fi
fi

echo "==> [7/7] Confirming automatic renewal is armed"
# The apt package ships certbot.timer; if it is not active, renewal silently
# never happens and the cert dies at 90 days.
if systemctl list-timers --all 2>/dev/null | grep -q certbot; then
  systemctl list-timers --all | grep certbot || true
else
  echo "    WARNING: certbot.timer not found — renewal is NOT automatic." >&2
  echo "    Enable it with: sudo systemctl enable --now certbot.timer" >&2
fi
# Non-fatal. The certificate is already issued and deployed by this point, so a
# failure here means the *check* did not complete, not that anything is broken.
# On a small instance this step has dropped the SSH connection (exit 255,
# "Broken pipe") — certbot is memory-hungry and this runs alongside the app and
# Postgres containers. Failing the whole run over it would be misleading.
if ! sudo certbot renew --dry-run; then
  echo "    WARNING: renewal dry-run did not complete cleanly." >&2
  echo "    The certificate is issued and live regardless. Re-check later with:" >&2
  echo "      sudo certbot renew --dry-run" >&2
fi

cat <<EOF

Done. Verify from your laptop — check the issuer, not just the padlock:

  curl -fsS https://$DOMAIN/health
  echo | openssl s_client -connect $DOMAIN:443 -servername $DOMAIN 2>/dev/null \\
    | openssl x509 -noout -issuer -dates

Then, once that looks right:
  - merge the ci-cd.yml change so the next deploy binds the app to 127.0.0.1
  - remove the 8000/tcp inbound rule from the EC2 security group
  - repoint frontend/.env.local at https://$DOMAIN (and wss:// for chat)
EOF
