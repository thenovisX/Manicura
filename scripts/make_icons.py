"""Genera los iconos de la app (PWA y Android) a partir de un dibujo sencillo."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
MAR = (45, 34, 40, 255)        # ciruela oscuro (fondo)
BLANCO = (255, 255, 255, 255)
ROSA = (214, 104, 140, 255)     # esmalte
BRILLO = (255, 255, 255, 150)


def motif(size, scale=1.0, bg=None, radius=0.0):
    """Bote de esmalte de uñas. scale = tamaño del dibujo respecto al lienzo."""
    S = size * 4  # dibujar grande y reducir = bordes suaves
    img = Image.new('RGBA', (S, S), bg or (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if bg and radius:
        img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * radius), fill=bg)
    c = S / 2
    u = S * scale / 100  # unidad: 1/100 del área del dibujo
    # tapón alto
    d.rounded_rectangle([c - 9 * u, c - 46 * u, c + 9 * u, c - 12 * u], radius=4 * u, fill=BLANCO)
    # cuello
    d.rectangle([c - 13 * u, c - 14 * u, c + 13 * u, c - 6 * u], fill=BLANCO)
    # bote
    d.rounded_rectangle([c - 30 * u, c - 8 * u, c + 30 * u, c + 46 * u], radius=14 * u, fill=BLANCO)
    d.rounded_rectangle([c - 25 * u, c - 3 * u, c + 25 * u, c + 41 * u], radius=10 * u, fill=ROSA)
    # brillo del cristal
    d.rounded_rectangle([c - 19 * u, c + 3 * u, c - 13 * u, c + 26 * u], radius=3 * u, fill=BRILLO)
    return img.resize((size, size), Image.LANCZOS)


def save(img, path, rgb=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    if rgb:
        bg = Image.new('RGB', img.size, MAR[:3])
        bg.paste(img, mask=img.split()[3])
        img = bg
    img.save(path)
    print('ok', path.relative_to(ROOT))


icons = ROOT / 'app' / 'www' / 'icons'
save(motif(192, 0.78, MAR, 0.22), icons / 'icon-192.png')
save(motif(512, 0.78, MAR, 0.22), icons / 'icon-512.png')
save(motif(512, 0.62, MAR), icons / 'icon-maskable-512.png')
save(motif(180, 0.74, MAR), icons / 'apple-touch-icon.png', rgb=True)

res = ROOT / 'app' / 'assets'
save(motif(1024, 0.74, MAR), res / 'icon-only.png', rgb=True)
save(motif(1024, 0.50), res / 'icon-foreground.png')
save(Image.new('RGBA', (1024, 1024), MAR), res / 'icon-background.png')
splash = Image.new('RGBA', (2732, 2732), MAR)
splash.alpha_composite(motif(700, 0.8), ((2732 - 700) // 2, (2732 - 700) // 2))
save(splash, res / 'splash.png', rgb=True)
save(splash, res / 'splash-dark.png', rgb=True)
