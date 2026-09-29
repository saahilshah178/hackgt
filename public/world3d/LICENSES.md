# 3D world assets: sources and licences

Downloaded by `pnpm world3d:assets` (scripts/fetch-world3d-assets.ts). Textures are re-encoded (resized, JPEG quality
~82) but otherwise unmodified.

## Textures (Poly Haven, CC0 1.0)

All Poly Haven assets are released under [CC0 1.0](https://polyhaven.com/license) (public domain; no attribution
required, credited here anyway).

| Name | Group | Source | Authors | Licence |
|---|---|---|---|---|
| `sand` | ground | [dense_sand](https://polyhaven.com/a/dense_sand) | Dimitrios Savva | CC0 1.0 |
| `dune_sand` | ground | [aerial_beach_01](https://polyhaven.com/a/aerial_beach_01) | Rob Tuytel | CC0 1.0 |
| `grass` | ground | [leafy_grass](https://polyhaven.com/a/leafy_grass) | Charlotte Baglioni | CC0 1.0 |
| `dry_grass` | ground | [park_dirt](https://polyhaven.com/a/park_dirt) | Christopher Melani | CC0 1.0 |
| `forest_floor` | ground | [forest_leaves_02](https://polyhaven.com/a/forest_leaves_02) | Rob Tuytel | CC0 1.0 |
| `mud` | ground | [brown_mud_02](https://polyhaven.com/a/brown_mud_02) | Rob Tuytel | CC0 1.0 |
| `gravel` | ground | [gravel_floor](https://polyhaven.com/a/gravel_floor) | Jenelle van Heerden, Matterfield | CC0 1.0 |
| `dirt` | ground | [dirt](https://polyhaven.com/a/dirt) | Charlotte Baglioni | CC0 1.0 |
| `rock` | ground | [rock_face_03](https://polyhaven.com/a/rock_face_03) | Dario Barresi, Rico Cilliers | CC0 1.0 |
| `cliff` | ground | [marble_cliff_02](https://polyhaven.com/a/marble_cliff_02) | Amal Kumar | CC0 1.0 |
| `dark_rock` | ground | [dark_rock](https://polyhaven.com/a/dark_rock) | Amal Kumar | CC0 1.0 |
| `snow` | ground | [snow_02](https://polyhaven.com/a/snow_02) | Rob Tuytel | CC0 1.0 |
| `ice` | ground | [snow_01](https://polyhaven.com/a/snow_01) | Rob Tuytel | CC0 1.0 |
| `regolith` | ground | [moon_01](https://polyhaven.com/a/moon_01) | Greg Zaal, Rico Cilliers, Jenelle van Heerden, Dario Barresi | CC0 1.0 |
| `cobble` | ground | [cobblestone_floor_01](https://polyhaven.com/a/cobblestone_floor_01) | Rob Tuytel | CC0 1.0 |
| `field` | ground | [farm_furrows](https://polyhaven.com/a/farm_furrows) | Amal Kumar | CC0 1.0 |
| `sandstone` | structure | [sandstone_blocks_08](https://polyhaven.com/a/sandstone_blocks_08) | Rob Tuytel | CC0 1.0 |
| `limestone` | structure | [large_sandstone_blocks_01](https://polyhaven.com/a/large_sandstone_blocks_01) | Rob Tuytel | CC0 1.0 |
| `marble` | structure | [marble_01](https://polyhaven.com/a/marble_01) | Rob Tuytel | CC0 1.0 |
| `granite` | structure | [granite_tile_03](https://polyhaven.com/a/granite_tile_03) | Charlotte Baglioni | CC0 1.0 |
| `basalt` | structure | [volcanic_rock_tiles](https://polyhaven.com/a/volcanic_rock_tiles) | Charlotte Baglioni | CC0 1.0 |
| `brick` | structure | [red_brick](https://polyhaven.com/a/red_brick) | Rob Tuytel | CC0 1.0 |
| `adobe` | structure | [clay_plaster](https://polyhaven.com/a/clay_plaster) | Amal Kumar | CC0 1.0 |
| `plaster` | structure | [white_plaster_rough_01](https://polyhaven.com/a/white_plaster_rough_01) | Rob Tuytel | CC0 1.0 |
| `wood` | structure | [weathered_planks](https://polyhaven.com/a/weathered_planks) | Dario Barresi, Dimitrios Savva | CC0 1.0 |
| `thatch` | structure | [thatch_roof_angled](https://polyhaven.com/a/thatch_roof_angled) | Rob Tuytel, Dimitrios Savva | CC0 1.0 |
| `metal` | structure | [metal_plate_02](https://polyhaven.com/a/metal_plate_02) | Rob Tuytel | CC0 1.0 |
| `bark` | vegetation | [pine_bark](https://polyhaven.com/a/pine_bark) | Dimitrios Savva | CC0 1.0 |
| `bark_palm` | vegetation | [palm_tree_bark](https://polyhaven.com/a/palm_tree_bark) | Dimitrios Savva, Rico Cilliers | CC0 1.0 |

Each folder holds `diff.jpg` (albedo, sRGB), `nor.jpg` (OpenGL normal map) and `arm.jpg` (R = ambient occlusion,
G = roughness, B = metalness).

## Water normals (three.js, MIT)

`textures/water/normal.jpg` is `examples/textures/waternormals.jpg` from [three.js](https://github.com/mrdoob/three.js)
(https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/waternormals.jpg), MIT licence, Copyright © 2010-2026 three.js authors.

## Procedural

Sky, clouds, stars, the moon and Earth discs, foliage cards, grass and rock geometry are generated in code
(src/world3d/kit); no image assets.
