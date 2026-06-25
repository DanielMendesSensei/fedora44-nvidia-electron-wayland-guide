# Fedora 44 + Acer Predator Helios Neo 16 + NVIDIA + Electron

A practical guide for solving two issues that often look like one, but are not:

1. Fedora 44 on an Intel + NVIDIA hybrid laptop where the RTX GPU is still being claimed by `nouveau` instead of the proprietary driver.
2. Electron apps on Linux/Wayland that start normally but never show a visible window.

> 🇧🇷 [Versão em Português disponível aqui](./README.pt-BR.md)

This repository was written from a real-world case on an **Acer Predator Helios Neo 16** with Fedora 44, Secure Boot enabled, and Electron development. Most of the material also applies to other Intel + NVIDIA hybrid laptops.

---

## The two-layer split

When debugging this class of failure, separate the problem into two layers:

- **Layer 1 — Graphics driver**: `nvidia-smi` fails, `lsmod` shows `nouveau`, the NVIDIA GPU exists in `lspci` but is not controlled by the proprietary stack.
- **Layer 2 — Electron windowing**: the app starts, the process stays alive, the icon appears in the dock, but the window is never drawn or stays invisible under Wayland.

Mixing these two layers usually slows down the investigation. Validate the graphics stack first; then move on to Electron-specific debugging.

---

## Decision flowchart

```
does nvidia-smi work?
├── NO  → Layer 1: go to docs/fedora44-helios-neo16-nvidia.md
└── YES
     └── does lsmod show nvidia* modules?
          ├── NO  → Layer 1: blacklist nouveau, rebuild dracut
          └── YES
               └── does the Electron window appear?
                    ├── YES → all good 🎉
                    └── NO  → Layer 2: go to docs/electron-wayland-window-not-showing.md
```

---

## Repository structure

```
.
├── README.md                              ← this file (English)
├── README.pt-BR.md                        ← same guide in Portuguese
├── docs/
│   ├── fedora44-helios-neo16-nvidia.md    ← Layer 1: driver setup & recovery
│   └── electron-wayland-window-not-showing.md  ← Layer 2: Electron + Wayland
├── scripts/
│   └── collect-debug.sh                  ← collect system diagnostics
└── examples/
    └── electron-diagnostic-main.js       ← minimal BrowserWindow with verbose logs
```

---

## Quick validation commands

```bash
echo $XDG_SESSION_TYPE
mokutil --sb-state
nvidia-smi
lsmod | grep -E 'nvidia|nouveau'
lspci -nnk | grep -A3 -Ei 'vga|3d|display|nvidia|intel'
```

Expected after fix: `nvidia-smi` returns the GPU and driver version, `lsmod` shows `nvidia`, `nvidia_modeset`, `nvidia_uvm`, `nvidia_drm`.

---

## Electron quick tests (Wayland)

```bash
npm start
ELECTRON_OZONE_PLATFORM_HINT=auto npm start
ELECTRON_OZONE_PLATFORM_HINT=wayland npm start
ELECTRON_DISABLE_GPU=1 npm start
```

---

## Contributions

Pull requests are welcome. If you solved the same problem on a different laptop model or Fedora version, feel free to add a note in the relevant doc.

---

## License

MIT
