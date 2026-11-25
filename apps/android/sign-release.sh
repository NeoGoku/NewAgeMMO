#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: sign-release.sh input.apk output.apk" >&2
  exit 2
fi
: "${ANDROID_HOME:?Set ANDROID_HOME}"
: "${NAM_ANDROID_KEYSTORE_B64:?Configure the persistent Android keystore}"
: "${NAM_ANDROID_KEYSTORE_PASSWORD:?Configure the keystore password}"
: "${NAM_ANDROID_CERT_SHA256:?Pin the Android certificate fingerprint}"

expected=$(printf '%s' "$NAM_ANDROID_CERT_SHA256" | tr -d ':' | tr '[:upper:]' '[:lower:]')
if [[ ! "$expected" =~ ^[0-9a-f]{64}$ ]]; then
  echo "Invalid Android signing certificate fingerprint." >&2
  exit 1
fi

signer=$(find "$ANDROID_HOME/build-tools" -name apksigner -type f | sort -V | tail -n 1)
if [[ ! -x "$signer" ]]; then
  echo "Android build-tools with apksigner are required." >&2
  exit 1
fi

umask 077
temp=$(mktemp -d)
trap 'rm -rf "$temp"' EXIT
printf '%s' "$NAM_ANDROID_KEYSTORE_B64" | base64 --decode > "$temp/release.p12"
"$signer" sign --ks "$temp/release.p12" --ks-type PKCS12 --ks-key-alias newagemmo \
  --ks-pass env:NAM_ANDROID_KEYSTORE_PASSWORD --key-pass env:NAM_ANDROID_KEYSTORE_PASSWORD \
  --out "$temp/signed.apk" "$1"

actual=$("$signer" verify --print-certs "$temp/signed.apk" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p')
if [[ "$actual" != "$expected" ]]; then
  echo "Android APK signing certificate differs from the pinned fingerprint." >&2
  exit 1
fi
install -m 0644 "$temp/signed.apk" "$2"
