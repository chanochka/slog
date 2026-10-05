# Иконка Слога в стиле учебника: розовый фон, белая карточка с тёмной обводкой и розовой тенью,
# на ней «С» со знаком ударения шрифтом M PLUS Rounded 1c и жёлтая звёздочка.
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "icons"
FONT = "D:/workbook/8-weeks-of-english/source/redesign/fonts/MPLUSRounded1c-ExtraBold.ttf"
BG, NAVY, PINK, WHITE = (251, 230, 236), (38, 50, 61), (232, 168, 186), (255, 255, 255)

def icon(size):
    s = 1024
    im = Image.new("RGB", (s, s), BG)
    d = ImageDraw.Draw(im)
    box = (200, 190, 800, 790)
    d.rounded_rectangle((box[0] + 44, box[1] + 44, box[2] + 44, box[3] + 44), 120, fill=PINK, outline=NAVY, width=0)
    d.rounded_rectangle(box, 120, fill=WHITE, outline=NAVY, width=22)
    f = ImageFont.truetype(FONT, 470)
    bb = d.textbbox((0, 0), "С", font=f)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    x, y = (box[0] + box[2] - w) / 2 - bb[0], (box[1] + box[3] - h) / 2 - bb[1] + 40
    d.text((x, y), "С", font=f, fill=NAVY)
    cx, top = (box[0] + box[2]) / 2 + 30, y + bb[1] - 120
    d.polygon([(cx - 22, top + 115), (cx + 26, top + 115), (cx + 112, top + 8), (cx + 52, top)], fill=NAVY)
    star = Image.open(ROOT / "sprites" / "star-yellow.png").convert("RGBA")
    star = star.resize((190, int(190 * star.height / star.width)), Image.LANCZOS).rotate(12, expand=True, resample=Image.BICUBIC)
    im.paste(star, (690, 110), star)
    return im.resize((size, size), Image.LANCZOS)

for n in (180, 192, 512):
    icon(n).save(OUT / f"icon-{n}.png", optimize=True)
print("ok")
