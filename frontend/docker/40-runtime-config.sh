#!/bin/sh
# Runs at container start (nginx image executes /docker-entrypoint.d/*.sh).
# Writes the backend address into config.js so the same built image works
# against any environment without a rebuild.
set -e
ESCAPED=$(printf '%s' "${API_URL:-}" | sed 's/\\/\\\\/g; s/"/\\"/g')
cat > /usr/share/nginx/html/config.js <<EOT
window.__CONFIG__ = { API_URL: "${ESCAPED}" };
EOT
echo "CareSync web: runtime API_URL='${API_URL:-}'"
