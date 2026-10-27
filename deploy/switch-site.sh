#!/usr/bin/env bash
# Switch which app nginx serves at https://sweeple.natreese.dev.
#
#   sudo ./switch-site.sh new      # this repo's Docker stack (client on 127.0.0.1:5173)
#   sudo ./switch-site.sh old      # the previous pm2 app (127.0.0.1:3000)
#   sudo ./switch-site.sh status   # show the current target
#
# nginx's site config proxies the domain to the "sweeple_app" upstream; this
# script rewrites that upstream and reloads nginx (no downtime). If the nginx
# config test fails, the previous upstream is restored.
set -euo pipefail

CONF=/etc/nginx/conf.d/sweeple-app.conf
DOMAIN=sweeple.natreese.dev

case "${1:-status}" in
  new) port=5173 ;;
  old) port=3000 ;;
  status)
    if [ -f "$CONF" ]; then
      port=$(grep -o '127\.0\.0\.1:[0-9]*' "$CONF" | cut -d: -f2)
      case "$port" in
        5173) echo "serving: new (Docker stack, port 5173)" ;;
        3000) echo "serving: old (pm2 app, port 3000)" ;;
        *) echo "serving: port $port" ;;
      esac
    else
      echo "not set up: $CONF does not exist"
    fi
    exit 0
    ;;
  *)
    echo "usage: $0 new|old|status" >&2
    exit 1
    ;;
esac

# Refuse to point the domain at something that is not answering
if ! curl -fsS -o /dev/null --max-time 10 "http://127.0.0.1:$port/"; then
  echo "nothing is answering on 127.0.0.1:$port; not switching" >&2
  exit 1
fi

backup=$(mktemp)
had_conf=false
if [ -f "$CONF" ]; then cp "$CONF" "$backup"; had_conf=true; fi

printf 'upstream sweeple_app {\n    server 127.0.0.1:%s;\n}\n' "$port" > "$CONF"

if ! nginx -t -q; then
  if $had_conf; then cp "$backup" "$CONF"; else rm -f "$CONF"; fi
  rm -f "$backup"
  echo "nginx config test failed; previous setting restored" >&2
  exit 1
fi
rm -f "$backup"

systemctl reload nginx
echo "now serving $1 (127.0.0.1:$port)"
curl -s -o /dev/null --max-time 15 -w "https://$DOMAIN/ -> HTTP %{http_code}\n" "https://$DOMAIN/" || true
