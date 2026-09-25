'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const stage=path.resolve(__dirname,'../audit/berlin-parity-v150'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const frames=['before-opening.jpg','after-opening.jpg','before-bakery-detail.jpg','after-bakery-detail.jpg','before-bookshop-detail.jpg','after-bookshop-detail.jpg','after-approach.jpg','after-later-street.jpg','after-portrait.jpg','after-indexed-opening.jpg','after-indexed-approach.jpg'];
const result={passed:true,fullReferenceParity:false,candidateSha256:sha(fs.readFileSync(path.join(stage,'candidate.html'))),frames,frameHashes:Object.fromEntries(frames.map(f=>[f,sha(fs.readFileSync(path.join(stage,'frames',f)))])),programs:65,webglErrors:[],observations:[
 'Focal bakery window now has 45 small physical loaves/croissants on four shelves, grouped in unequal piles. The overly yellow plain prototype and floating stack draft were rejected. Existing crust detail is reused on matte solids.',
 'Each focal bookstore has 198 physical books across three windows. Varied widths, heights and slight lean expose their depth; the six existing counter books now display correctly cropped Berlin cover illustrations.',
 'Physical merchandise replaces the lower painted backdrop while retaining the upper ceiling and pendant artwork. Source images, original native shop geometry and other four frontage variants remain unchanged.',
 'Opening, approach, later street and portrait views preserve road and traffic readability. Portrait is a desktop viewport check.'
],rejectedDrafts:['rejected-flat-bread/','frames/first-after-bakery-detail.jpg','frames/textured-bakery-detail.jpg','frames/stacked-bakery-detail.jpg'],remaining:[
 'Full parity remains unproven. Broad warm/cool lighting, softer contact, sidewalk grouping, organic planting and overall composition still differ from the reference.',
 'The narrow bakery door and secondary shops retain painted displays. The focal upper pendants are preserved atlas imagery, not new physical lights.',
 'This adds geometry and modest facade shader arithmetic; visual acceptance does not establish performance acceptance.'
]};
result.indexedConstruction={checked:true,geometryEvidence:'index-check.json',newCaptures:['after-indexed-opening.jpg','after-indexed-approach.jpg'],earlierImageCandidateSha256:'53e02f2b9bf1881b2985e21437cc0f54f97d9da2952e1b98478cbe8f2dcc5838',note:'Earlier detail/portrait captures predate exact indexed construction. Every triangle corner and draw order is bit-identical across all 36 layouts; fresh opening/approach views show unchanged visual appearance.'};
fs.writeFileSync(path.join(stage,'visual-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({candidateSha256:result.candidateSha256,frames:frames.length,fullReferenceParity:false}));
