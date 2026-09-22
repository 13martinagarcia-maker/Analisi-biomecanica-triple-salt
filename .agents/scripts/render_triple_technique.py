import fitz
from pathlib import Path
pdf = Path('attached_assets/TÈCNICA_I_BIOMECÀNICA_DEL_TRIPLE_SALT_(13)_1790115914667.pdf')
pages = Path('.agents/outputs/triple-technique-pages')
images = Path('.agents/outputs/triple-technique-images')
doc = fitz.open(pdf)
for i, page in enumerate(doc):
    pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    pix.save(pages / f'page-{i+1:02}.png')
    for j, info in enumerate(page.get_images(full=True)):
        xref = info[0]
        data = doc.extract_image(xref)
        (images / f'page-{i+1:02}-image-{j+1:02}.{data["ext"]}').write_bytes(data['image'])
print(f'pages={doc.page_count}, extracted_images={len(list(images.iterdir()))}')
