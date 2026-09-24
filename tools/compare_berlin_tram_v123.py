"""Equal-height source crops for the tram art review, without retouching."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[1];stage=root/'audit/berlin-tram-reference-v123'
images=[('Reference',root/'audit/berlin-kiez-art-direction-v1.png',(958,322,1115,532)),
        ('V122 — previous',stage/'before-opening.png',(690,277,815,458)),
        ('V123 — rebuilt',stage/'after-opening.png',(690,277,815,458))]
canvas=Image.new('RGB',(948,462),'#192d38');draw=ImageDraw.Draw(canvas)
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',19)
for i,(label,file,box) in enumerate(images):
    crop=Image.open(file).convert('RGB').crop(box);height=390
    crop=crop.resize((round(crop.width*height/crop.height),height),Image.Resampling.LANCZOS)
    x=16+i*310;draw.text((x,15),label,fill='#f1e8d5',font=font);canvas.paste(crop,(x,52))
canvas.save(stage/'tram-comparison.png')
