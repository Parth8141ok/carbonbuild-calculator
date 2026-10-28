# Reference data extracted from the source documents

Sources read for this implementation:

- `B.Tech.Project. (1).pdf`: *Carbon Footprint Assessment of Construction Projects*, B.Tech Project 2026, Sarvajanik University, Surat (Chapters 1–6).
- `Chapters_7_to_14_BIM_Carbon_Footprint.pdf`: BIM-based assessment (Chapters 7–14).

The PDFs are not included in this repository. Add them under `docs/` if reviewers need to verify the values below. Every value here is encoded in `src/lib/engine/factors.ts` and `src/lib/engine/sample.ts`.

## Emission factors

| Factor | Value | Boundary | Source location |
|---|---:|---|---|
| OPC, grade 43/53 | 0.82–0.95 kg CO₂e/kg | not stated | B.Tech Ch. 3 table |
| PPC, 25–30% fly ash | 0.58–0.65 | not stated | B.Tech Ch. 3 |
| RMC M25/M30 | 0.12–0.14 | not stated | B.Tech Ch. 3 |
| High-strength concrete M50/M60 | 0.18–0.22 | not stated | B.Tech Ch. 3 |
| Rebar | 1.80–2.40 | not stated | B.Tech Ch. 3; BIM §13.3 |
| Structural steel sections | 1.90–2.50 | not stated | B.Tech Ch. 3 |
| Concrete production (~30 MPa) | 0.13 | A1–A3 | BIM Table 9.3 (foundation) |
| Concrete waste processing/disposal | 0.012 | C2–C4 | BIM Table 9.3 (foundation) |
| Structural concrete | 0.142 | production + site waste disposal | BIM Table 9.3 (plinth, columns, beams) |
| Slab concrete | 0.138 | not stated | BIM Table 9.3 (slabs) |
| Reinforcement steel | 1.92 | production + trim waste | BIM Table 9.3 |
| Clay brick | 0.24 | production | BIM Table 9.3 |
| Diesel | 2.68 kg CO₂e/L | combustion | BIM Table 9.3 |

For ranges, the central value is the arithmetic midpoint. That is an implementation choice, not a value from the source.

Conversion parameters (not emission factors): RCC density 2,400 kg/m³; 500 bricks/m³; 3 kg per brick; openings 25%; transit mixer 7 m³; RMC 30 km round trip at 2.5 km/L; delivery 40 km round trip at 3.5 km/L; machinery 4.5 L/h.

## Reference quantities (per bungalow; 10 identical; 3 storeys; 110 m² per floor)

| Element | Quantity | Waste |
|---|---|---:|
| Foundation concrete | 45 m³ | 5% |
| Plinth concrete / steel | 14 m³ / 1,100 kg | 6% / 5% |
| Columns & beams concrete / steel | 72 m³ / 7,800 kg | 6% / 6% |
| Slab concrete / steel | 48 m³ / 4,200 kg | 4% / 4% |
| Brickwork | 206.50 m³ (≈103,250 bricks; one quantity, two representations) | 8% |
| RMC transit mixers | 20 trips × 30 km round trip, 2.5 km/L | |
| Delivery trucks | 45 trips × 40 km round trip, 3.5 km/L | |
| Site machinery | 120 h × 4.5 L/h | |

## Reported totals and how the engine compares

| Item | Report | Engine (full precision) |
|---|---:|---:|
| Material wastage (excl. foundation) | 9,668.35 | 9,668.352 |
| Logistics & machinery | 3,468.67 | 3,468.686 |
| Total per bungalow (master schedule) | 13,137.02 | 13,137.038 |
| Ten bungalows | 131,370.20 | 131,370.377 |
| Foundation (sensitivity only) | 766.80 | 766.800 |
| Per bungalow incl. foundation | 13,903.82 | 13,903.838 |

## Discrepancies found in the sources

1. **Foundation excluded from the master total.** Table 9.10 and the Chapter 4 compilation omit the 766.80 kg foundation calculation; §9.11 gives 13,903.82 as a sensitivity case. → Two calculation profiles; both totals always shown.
2. **Ambiguous foundation scope.** B.Tech p.19 calls the 45 m³ the "slab/beam/column zone" of the foundation stage, which could overlap other volumes. → Flagged; kept as an optional profile.
3. **Chapter 4 typos.** Columns & beams steel printed as "168 kg" (correct: 468 kg); plinth steel emission printed as 286.27 (correct: 105.60). Both are noted in BIM §9.11. → The engine calculates from the quantities.
4. **Mislabelled Chapter 5 fuel step.** The "RMC" step shows the delivery-truck figures (1,800 km ÷ 3.5). → The sample uses BIM Table 9.9's vehicle groups.
5. **Truncated diesel.** 514.2857 L is reported as 514.28 L. → The engine keeps full precision; the 0.0177 kg/bungalow difference is shown.
6. **Brickwork rounding.** 68.8275 m³/floor is reported as 68.83; 206.50 m³ total (68.83 × 3 = 206.49). → The sample uses 206.50 m³; the estimator derives 206.4825 m³.
7. **RMC trips exclude foundation concrete** (134 m³ → 20 trips), and the foundation sensitivity adds no extra deliveries. → Reproduced as reported; the estimator has an option to include it.
