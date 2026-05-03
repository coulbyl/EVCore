#!/bin/sh
set -eu

mkdir -p /app/logrotate

STATE_FILE="/app/logrotate/status"
CONFIG_FILE="/app/logrotate.conf"

touch "$STATE_FILE"
chmod 600 "$STATE_FILE"

exec logrotate -s "$STATE_FILE" "$CONFIG_FILE"
