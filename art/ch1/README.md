# Capítulo 1 art

Required print-grade JPEGs (short edge ≥1400 px here: 2100×1400, ≥300 ppi at placed size):

- `courtyard.jpg` — opener: Don Rafael, Tomás, Ana (embarazada), Lola the hen, maleta. No letters in the pixels.
- `abuelo-esposos.jpg` — RELACIONES: Don Rafael → Tomás → Ana (embarazada, esposos).
- `puerta.jpg` — actor-neutral closed wooden door that looks like it would creak. No people. Not a broken door.
- `gota.jpg` — one drop falling into a bucket. No people.
- `lola.jpg` — brown hen, a hen not a decoration.

No letters in the pixels. Live labels (la maleta, Lola, CRIIIC, una gota, un ruido, el techo, names) stay pdf-lib overlays.

GitHub MCP mangles binaries; upload JPEGs in the GitHub web UI as NextGreatEra if a Contents-API commit fails a SHA256 check.
`server/lib/print.ts` fails closed if any slot is missing or short edge < 900 px.
