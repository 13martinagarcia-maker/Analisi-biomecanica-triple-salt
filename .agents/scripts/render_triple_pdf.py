import fitz
from pathlib import Path
pdf = fitz.open('attached_assets/TÈCNICA_I_BIOMECÀNICA_DEL_TRIPLE_SALT_(7)_1789998274911.pdf')
out = Path('.agents/outputs/pdf-triple')
print('pages', pdf.page_count)
for i, page in enumerate(pdf):
    pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    pix.save(out / f'page-{i+1:02}.png')
