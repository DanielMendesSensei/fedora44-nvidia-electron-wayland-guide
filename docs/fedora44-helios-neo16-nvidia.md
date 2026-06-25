# Fedora 44 + NVIDIA Proprietary Driver (Acer Predator Helios Neo 16)

> **Target**: Fedora 44, hybrid Intel + NVIDIA laptop, Secure Boot enabled, `nouveau` loaded instead of `nvidia`.

---

## Symptoms

- `nvidia-smi` → `couldn't communicate with the NVIDIA driver`
- `lsmod | grep -E 'nvidia|nouveau'` → only `nouveau` appears, no `nvidia*` modules
- `lspci -nnk` → NVIDIA GPU present, but `Kernel driver in use: nouveau`
- System boots, Wayland session works, but GPU is not using the proprietary driver

---

## Step 1 — Confirm the current state

```bash
# Session type
echo $XDG_SESSION_TYPE

# Secure Boot status
mokutil --sb-state

# Kernel modules loaded
lsmod | grep -E 'nvidia|nouveau'

# GPU info
lspci -nnk | grep -A3 -Ei 'vga|3d|display|nvidia|intel'

# Check if nvidia-smi works
nvidia-smi
```

---

## Step 2 — Install NVIDIA driver via RPM Fusion

```bash
# Enable RPM Fusion (if not already enabled)
sudo dnf install \
  https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-$(rpm -E %fedora).noarch.rpm \
  https://mirrors.rpmfusion.org/nonfree/fedora/rpmfusion-nonfree-release-$(rpm -E %fedora).noarch.rpm

# Install NVIDIA akmod (recommended for Fedora)
sudo dnf install akmod-nvidia xorg-x11-drv-nvidia-cuda

# Wait for the module to build (can take a few minutes)
sudo akmods --force

# Verify the module was built
ls /lib/modules/$(uname -r)/extra/nvidia/
```

---

## Step 3 — Handle Secure Boot (MOK enrollment)

If Secure Boot is enabled, the NVIDIA kernel module must be signed. The `akmods` package handles this automatically, but you need to enroll the key.

```bash
# Check if the akmods key exists
ls /etc/pki/akmods/certs/

# Enroll the key for Secure Boot
sudo mokutil --import /etc/pki/akmods/certs/public_key.der
# You will be asked to set a one-time enrollment password.
# Keep this password — you will need it during the next boot.
```

On the next reboot, the MOK Manager screen will appear. Select **"Enroll MOK"**, confirm with the password you set, and proceed to boot.

---

## Step 4 — Blacklist nouveau

Even after installing the NVIDIA driver, `nouveau` may still load first and prevent `nvidia` from taking over.

```bash
# Create the blacklist file
sudo tee /etc/modprobe.d/disable-nouveau.conf <<'EOF'
blacklist nouveau
options nouveau modeset=0
EOF

# Regenerate initramfs to include the blacklist
sudo dracut --force
```

---

## Step 5 — Reboot and validate

```bash
sudo reboot
```

After reboot:

```bash
# Should return GPU name and driver version
nvidia-smi

# Should show nvidia, nvidia_modeset, nvidia_uvm, nvidia_drm
lsmod | grep nvidia

# nouveau should NOT appear
lsmod | grep nouveau
```

---

## Troubleshooting

### Module still not loading after reboot

```bash
# Check if the module was built for the current kernel
sudo akmods --force
sudo dracut --force
sudo reboot
```

### Secure Boot: MOK Manager did not appear

Check if the key was properly queued:

```bash
mokutil --list-new
```

If empty, repeat the `mokutil --import` step.

### GPU still showing nouveau in lspci

Confirm the blacklist file is in place and dracut was regenerated:

```bash
cat /etc/modprobe.d/disable-nouveau.conf
lsinitrd | grep nouveau   # should return nothing or show it's blocked
```

---

## Notes specific to Helios Neo 16

- The Helios Neo 16 uses an Intel iGPU + NVIDIA dGPU (Optimus) setup. Wayland uses the Intel GPU by default for rendering; NVIDIA handles compute and is offloaded as needed.
- After fixing the driver, `glxinfo -B` may still show `Intel` as the renderer. This is normal for Optimus on Wayland — it does not mean the NVIDIA driver is broken.
- `nvidia-smi` returning valid output confirms the proprietary driver is active.

---

## Reference commands cheatsheet

| Command | Purpose |
|---|---|
| `nvidia-smi` | Confirm driver and GPU status |
| `lsmod \| grep nvidia` | Confirm loaded kernel modules |
| `lsmod \| grep nouveau` | Confirm nouveau is NOT loaded |
| `lspci -nnk` | Confirm which kernel driver owns each GPU |
| `mokutil --sb-state` | Check Secure Boot status |
| `mokutil --list-new` | Check pending MOK enrollment |
| `sudo akmods --force` | Force rebuild NVIDIA module |
| `sudo dracut --force` | Regenerate initramfs |
