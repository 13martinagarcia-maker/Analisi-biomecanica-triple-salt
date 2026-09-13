import fitz
from pathlib import Path

pdf = Path('attached_assets/ESCALFAMENT_TRIPLE_SALT_(2)_1789315372413.pdf')
out_dir = Path('.agents/outputs/escalfament-pdf')
out_dir.mkdir(parents=True, exist_ok=True)

doc = fitz.open(pdf)
print(f'pages={doc.page_count}')
for index, page in enumerate(doc, start=1):
    pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    output = out_dir / f'page-{index}.png'
    pix.save(output)
    print(output)
