# Fedora 44 + Acer Predator Helios Neo 16 + NVIDIA + Electron

Guia prático para resolver dois problemas que frequentemente parecem ser um só, mas não são:

1. Fedora 44 em notebook híbrido Intel + NVIDIA onde a RTX ainda está sendo assumida pelo `nouveau` em vez do driver proprietário.
2. Aplicativos Electron em Linux/Wayland que iniciam normalmente, mas nunca mostram uma janela visível.

> 🇺🇸 [English version available here](./README.md)

Este repositório foi escrito a partir de um caso real num **Acer Predator Helios Neo 16** com Fedora 44, Secure Boot habilitado e desenvolvimento em Electron. A maior parte do material também se aplica a outros notebooks Intel + NVIDIA.

---

## A divisão em duas camadas

Ao depurar esse tipo de falha, vale separar o problema em duas camadas:

- **Camada 1 — Driver gráfico**: `nvidia-smi` falha, `lsmod` mostra `nouveau`, a GPU NVIDIA aparece no `lspci` mas não está sendo controlada pelo stack proprietário.
- **Camada 2 — Janela do Electron**: o app sobe, o processo fica vivo, o ícone aparece no dock, mas a janela nunca é desenhada ou fica invisível no Wayland.

Misturar as duas camadas costuma atrasar o diagnóstico. Valide primeiro a pilha gráfica; depois passe para a depuração específica do Electron.

---

## Fluxo de decisão

```
nvidia-smi funciona?
├── NÃO → Camada 1: vá para docs/fedora44-helios-neo16-nvidia.md
└── SIM
     └── lsmod mostra módulos nvidia*?
          ├── NÃO → Camada 1: blacklist nouveau, rebuild dracut
          └── SIM
               └── a janela do Electron aparece?
                    ├── SIM → tudo certo 🎉
                    └── NÃO → Camada 2: vá para docs/electron-wayland-window-not-showing.md
```

---

## Estrutura do repositório

```
.
├── README.md                              ← versão em inglês
├── README.pt-BR.md                        ← este arquivo (português)
├── docs/
│   ├── fedora44-helios-neo16-nvidia.md    ← Camada 1: driver setup e recuperação
│   └── electron-wayland-window-not-showing.md  ← Camada 2: Electron + Wayland
├── scripts/
│   └── collect-debug.sh                  ← coleta diagnósticos do sistema
└── examples/
    └── electron-diagnostic-main.js       ← BrowserWindow mínima com logs detalhados
```

---

## Comandos rápidos de validação

```bash
echo $XDG_SESSION_TYPE
mokutil --sb-state
nvidia-smi
lsmod | grep -E 'nvidia|nouveau'
lspci -nnk | grep -A3 -Ei 'vga|3d|display|nvidia|intel'
```

Resultados esperados após a correção: `nvidia-smi` retorna a GPU e a versão do driver, `lsmod` mostra `nvidia`, `nvidia_modeset`, `nvidia_uvm`, `nvidia_drm`.

---

## Testes rápidos do Electron (Wayland)

```bash
npm start
ELECTRON_OZONE_PLATFORM_HINT=auto npm start
ELECTRON_OZONE_PLATFORM_HINT=wayland npm start
ELECTRON_DISABLE_GPU=1 npm start
```

---

## Contribuições

Pull requests são bem-vindos. Se você resolveu o mesmo problema em um modelo de notebook diferente ou versão do Fedora, fique à vontade para adicionar uma nota na documentação relevante.

---

## Licença

MIT
