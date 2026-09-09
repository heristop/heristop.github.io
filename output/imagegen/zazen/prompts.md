# Prompts utilisés

Mode : outil intégré `image_gen`.

## Décors

Use case: style-transfer.
Asset type: production game sprite atlas for the existing Japanese isometric garden game Zazen.
Input image 1 is the edit target: a 4-column by 4-row atlas of 16 existing pixel-art props. Redraw every prop with substantially better pixel-art craftsmanship: more organic and recognizable silhouettes, careful pixel clusters, warm highlights from upper left, deep readable edge shadows, restrained texture, charming premium 16-bit Japanese garden art. Keep the objects' identities, positions, relative sizes, and garden mood.
Output: portrait PNG 1024x2048, EXACT 4 columns x 4 rows of equal 256x512 cells, with a genuinely TRANSPARENT background (no opaque backdrop or checkerboard). Each sprite remains centered in its own cell; base at 88% of cell height, maximum width 90%. No sprite crosses a cell boundary. No ground tiles, cast shadows, labels, text, outlines of cells, borders, watermark, or extra objects. Clean cutouts.
Draw as deliberate low-resolution pixel art: each cell is logically 32x64 pixels, enlarged 8x with uniform hard square pixels, no antialiasing, blur, tiny high-resolution detail, smooth paint or 3D rendering. Silhouettes must remain readable at 32x64.
Exact objects in reading order:
Row 1: sculptural Japanese evergreen pine with tiered irregular green boughs and warm trunk; green Japanese maple with organic airy canopy; cherry blossom sakura with rose-pink clustered blossoms and visible branches; tall three-stem leafy bamboo.
Row 2: shorter two-stem bamboo; graceful clump of reeds; small angular mossy garden rock; larger mossy rock mound.
Row 3: elegant stone lantern unlit; IDENTICAL stone lantern with warm pale golden light in window; traditional muted vermilion torii gate with curved lintel and two pillars; five-tier weathered stone pagoda.
Row 4: faceted dark rose stone marker with small simple angular engraved rune; IDENTICAL marker softly illuminated with pale warm cap and bright angular rune; weathered short wooden post; bamboo shishi-odoshi spout above a carved stone water basin.
Keep varied object heights as reference: rocks occupy only bottom fifth of cell, reed/bamboo/pagoda/lantern occupy lower half to two-thirds, trees and torii almost full height. Color family: warm sand #ecdcb4, tan #d4bd94, earthy #ac916b, jade #a4b878 #748f60 #425e48, stone #d6c4a7 #a9977c #756b58, rose #d9838d #ad4d64 #70354b, ink #4a4038 #2e2721. Better nuanced shapes, not more visual noise.

## Pèlerin

Use case: style-transfer.
Asset type: production walking character sprite sheet for the Japanese garden game Zazen.
Input image 1 is the edit target. Redraw this exact little pilgrim with much better handcrafted pixel art: a charming readable small face, a beautifully shaped woven conical straw kasa hat, charcoal-brown layered travel robes with warm edge lights, a small tan side satchel, sash, small dark shoes. Preserve character identity, clothing, direction order, all twelve poses, and the animation layout. No additional props.
Output a portrait PNG 864x1920 with a truly transparent background, exactly 3 equally sized columns and 4 equally sized rows. Every 288x480 cell is a logical 24x40 sprite enlarged 12x with sharp square pixels. No gaps between cells, each complete full-body sprite centered within its own cell with margins and feet at logical y=37. Do not overlap or crop sprites. No floor or cast shadow, no text, borders, labels, checkerboard or background.
Exact row order: row 1 faces south toward viewer; row 2 faces west, three-quarter left; row 3 faces east, three-quarter right; row 4 faces north away from viewer (back of hat and robe, no face). EXACT THREE animation frames per row: neutral standing pose, step forward left leg, step forward right leg. The walk must alternate feet clearly while keeping the same character proportions and hat width in each frame. Gentle one-pixel body bob. Hands and robe respond to the stride.
Style: expressive premium 16-bit pixel art with deliberate clean pixel clusters, not realistic, not smooth digital painting, no anti-aliased lines. Head is about one-third of the figure. Warm top-left light, strong quiet silhouette against pale sand, nuanced cloth folds within a limited earthy palette #ecdcb4 #d4bd94 #ac916b #d6c4a7 #a9977c #756b58 #4a4038 #2e2721. Small friendly dark eyes, not hollow sockets. Keep feet close to consistent baseline. This must be an actual usable animation sprite sheet, not a poster.

## Personnages et animaux

Use case: style-transfer.
Asset type: redesigned game sprite atlas of all supporting characters for Zazen, a gentle Japanese isometric garden game.
Input image 1 is the edit target: exactly four columns and eight rows of character sprites. Input image 2 is a STYLE reference for the newly redesigned pilgrim; match its warm earthy pixel art, well-shaped clothing and hats, appealing chibi faces, dimensional shading, clear silhouettes and dark warm outlines. Do not put the pilgrim in the output.
Redraw all 32 frames in image 1 with substantially better expressive pixel-art craft. Output portrait 1024x2304, exactly 4 equally spaced columns, 8 equally spaced rows, one centered full-body subject in each cell. Preserve exact order and identity. Give generous space between frames, identical baseline within each row, no touching or cropping. Flat solid dark teal background #233c42 uniformly everywhere behind sprites; no checkerboard, no swirls, no gradients or background pattern, no cast shadows or floor tiles. No text, no labels, no borders.
Row 1: FOUR idle animation poses of the same kindly older gardener, wearing a broad brim straw hat, jade-green gardening apron, dark shoes, white sideburns and tiny white beard, holding an upright bamboo rake in his right hand. Subtle breathing/blink variation.
Row 2: the SAME gardener in FOUR sequential raking poses: rake forward, rake pulling sand, pull completed, return. Make poses meaningfully different while keeping identity and proportions.
Row 3: FOUR WALK CYCLE frames of a charming cream-colored calico cat, tan and dark patches, pink ear interiors, curled upright tail; faces right. Anatomically clear alternating paws and tail motion.
Row 4: FOUR idle poses of the same young Japanese woman in a sage-green floral kimono, rose obi, black shimada bun and small rose hairpin. Kind expressive face, relaxed hands together. Breathing, blink and small hand gesture. Full length kimono, no hat.
Row 5: FOUR idle poses of a quiet seated monk in warm gray-brown robes, with a short dark hair cap, hands together in meditation. Soft friendly face, breathing and blink.
Row 6: the SAME WOMAN from row 4 as a modest storybook mermaid, same face, same black updo and rose hairpin, rose fabric bodice, curled jade-turquoise fish tail with a forked fin. FOUR subtle tail-swish frames.
Row 7: FOUR poses of a small friendly moss-green frog viewed at three quarters: relaxed squat, breathing with cheeks puffed, blinking, small stretch. Clear prominent eyes and folded hind legs.
Row 8: FOUR frames of a cream-and-rose koi carp swimming LEFT seen from above at a slight isometric angle: alternating tail strokes. Red dorsal patches, forked tail, tiny fins, no water backdrop or ripples.
Pixel art aesthetic should be cohesive with image 2: controlled crisp pixel clusters, restrained earthy jade/sand/rose palette, warm top-left highlights, no realistic painting or vector style. Head one-third of human height. Characters must stay recognizable when reduced to small game sprites.

## Finition des deux premières planches

Le premier essai demandait une transparence réelle. Un second essai de détourage demandait de supprimer uniquement le damier et de livrer un PNG RGBA à alpha nul en arrière-plan ; le résultat est resté RGB opaque. La finition retenue demandait de remplacer uniquement le damier et les artefacts par un fond uniforme #233c42, en conservant les sujets, les couleurs, les poses et les positions.
