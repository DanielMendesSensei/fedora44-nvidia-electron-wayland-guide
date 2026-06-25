#!/usr/bin/env bash
# collect-debug.sh
# Collects system information useful for diagnosing NVIDIA + Wayland + Electron issues
# on Fedora 44. Run this script and share the output when asking for help.

set -euo pipefail

OUTFILE="debug-$(date +%Y%m%d-%H%M%S).txt"

log() {
  echo "" >> "$OUTFILE"
  echo "=== $1 ==" >> "$OUTFILE"
  echo "" >> "$OUTFILE"
}

run() {
  local label="$1"; shift
  log "$label"
  (eval "$@" >> "$OUTFILE" 2>&1) || echo "[command failed or not available]" >> "$OUTFILE"
}

echo "Collecting debug information..."
echo "Debug report" > "$OUTFILE"
echo "Generated: $(date)" >> "$OUTFILE"

run "OS / Kernel" "cat /etc/os-release; uname -r"
run "Session type" "echo XDG_SESSION_TYPE=\$XDG_SESSION_TYPE"
run "Secure Boot" "mokutil --sb-state"
run "CPU / GPU (lspci)" "lspci -nnk | grep -A3 -Ei 'vga|3d|display|nvidia|intel'"
run "Loaded kernel modules (nvidia/nouveau)" "lsmod | grep -E 'nvidia|nouveau' || echo 'none found'"
run "nvidia-smi" "nvidia-smi"
run "glxinfo" "glxinfo -B 2>/dev/null || echo 'glxinfo not installed'"
run "Kernel cmdline" "cat /proc/cmdline"
run "modprobe blacklist files" "ls /etc/modprobe.d/ && cat /etc/modprobe.d/disable-nouveau.conf 2>/dev/null || echo 'no disable-nouveau.conf found'"
run "MOK pending enrollment" "mokutil --list-new 2>/dev/null || echo 'no pending MOK keys'"
run "akmods status" "ls /lib/modules/\$(uname -r)/extra/nvidia/ 2>/dev/null || echo 'nvidia modules not found in /lib/modules'"
run "dmesg (nvidia/nouveau)" "dmesg | grep -Ei 'nvidia|nouveau' | tail -50"
run "Electron version (if installed locally)" "./node_modules/.bin/electron --version 2>/dev/null || npx electron --version 2>/dev/null || echo 'electron not found in current directory'"
run "Node / npm versions" "node --version; npm --version"

echo ""
echo "Debug report saved to: $OUTFILE"
echo "Share this file when reporting issues."
