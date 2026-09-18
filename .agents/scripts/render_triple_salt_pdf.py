import fitz
from pathlib import Path
src = Path('attached_assets/TÈCNICA_I_BIOMECÀNICA_DEL_TRIPLE_SALT_(5)_1789695077055.pdf')
out = Path('.agents/outputs/triple-salt-pdf')
doc = fitz.open(src)
for i, page in enumerate(doc):
    pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    pix.save(out / f'page-{i+1:02d}.png')
print(f'rendered {doc.page_count} pages')
