# Zazen — sprites redessinés

Quatre planches sources produites avec l’outil intégré `image_gen`, à partir des sprites existants du projet. L’outil n’expose pas de sélection de modèle ; la version « Image 2.5 » demandée ne peut pas être confirmée.

- `decors-v2.png` : 16 décors, grille de 4 colonnes et 4 lignes.
- `pilgrim-walk-v2.png` : 12 poses du pèlerin, grille de 3 colonnes et 4 lignes ; directions sud, ouest, est, nord.
- `characters-v2.png` : 32 poses, grille de 4 colonnes et 8 lignes ; jardinier au repos, jardinier au râteau, chat, femme en kimono, moine, sirène, grenouille, carpe koï.
- `bird-flight-v2.png` : huit poses de vol, grille de quatre colonnes et deux lignes.

Direction visuelle : pixel art plus expressif, silhouettes organiques, matières mieux définies, lumière venant du haut à gauche et palette terre, jade et rose.

## État des livrables

Ces quatre planches restent les sources graphiques originales sur fond bleu-vert opaque. Le script `scripts/zazen-art/redesigned.mjs` retire ce fond, repère les gouttières entre les dessins, découpe les poses et les recale aux points de contact du jeu. Les poses de l’oiseau partagent une échelle et un point d’ancrage sur l’œil : le corps reste stable pendant le battement des ailes.

Les 32 sprites remplacent maintenant les personnages, décors et oiseaux dans `public/images/zazen/`. Leurs versions haute résolution sont exportées directement depuis ces sources dans `public/images/zazen/hd/`, à quatre fois la résolution logique. Les versions natives servent de repli. Les terrains et les autres effets restent issus des cartes de pixels existantes.

Le moteur GPU charge les textures avec une densité de 4 ; le rendu DOM utilise les mêmes images HD avec des dimensions CSS explicites ou un `srcset` à densité 4x. Le canvas est rendu à une densité de 2 à 3 selon l’écran. Les silhouettes des personnages sont agrandies tout en conservant leurs points de contact et les coordonnées de déplacement.

Les cycles absents des planches (respiration du pèlerin, marche du jardinier, salut du chat) sont dérivés des nouvelles poses par recalage des parties du corps. L’attaque réutilise les poses du râteau dans les six cellules existantes. La commande `npm run generate:art` reproduit les fichiers natifs et HD, sans nouvel appel au générateur d’images.

Les prompts de création sont conservés dans `prompts.md` et `bird-prompt.md`.
