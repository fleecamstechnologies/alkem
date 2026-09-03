# shellcheck shell=bash
# Small helpers for managing the backend dotenv on the server.
# Sourced by the deploy workflow's remote script.

# read_env_var <file> <KEY>  -> prints the value (last wins), empty if absent
read_env_var() {
  local file="$1" key="$2"
  [ -f "$file" ] || return 1
  grep -E "^${key}=" "$file" | tail -n1 | cut -d'=' -f2- | sed -e 's/^"//' -e 's/"$//'
}

# patch_env_var <file> <KEY> <VALUE>  -> upsert KEY=VALUE, keeping other keys
patch_env_var() {
  local file="$1" key="$2" value="$3" tmp
  tmp="$(mktemp)"
  touch "$file"
  grep -vE "^${key}=" "$file" > "$tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  install -m 600 "$tmp" "$file"
  rm -f "$tmp"
}

# sanitize_env_file <file>  -> strip CRLF, BOM and blank-only lines
sanitize_env_file() {
  local file="$1" tmp
  [ -f "$file" ] || return 0
  tmp="$(mktemp)"
  sed -e 's/\r$//' -e '1s/^\xEF\xBB\xBF//' "$file" | grep -vE '^\s*$' > "$tmp" || true
  install -m 600 "$tmp" "$file"
  rm -f "$tmp"
}

# validate_backend_env_file <file>  -> exit 1 if it isn't a usable dotenv
validate_backend_env_file() {
  local file="$1"
  if grep -qE '^-----BEGIN ' "$file"; then
    echo "backend.env looks like a private key, not a dotenv file." >&2
    return 1
  fi
  local missing=()
  for k in DB_HOST DB_PORT DB_USERNAME DB_PASSWORD DB_DATABASE JWT_SECRET; do
    grep -qE "^${k}=.+" "$file" || missing+=("$k")
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    printf 'backend.env is missing required key(s): %s\n' "${missing[*]}" >&2
    return 1
  fi
}
