/**
 * prefabs/_cables — shared cord and cable drawing (docs/design/20 §7.2 KB; owned by KB (L7), imported read-only by KC:
 * switchboard patch cords (verlet), cause_tubes wires (sag / vertical) and big_board tubes (manhattan), and by KB's
 * pump_rewiring cables). `geometry.ts` is pure and unit-tested; `draw.ts` renders it with a Phaser Graphics.
 */
export * from "./geometry";
export { createCable, strokeCable, DEFAULT_CABLE_STYLE, type CableHandle, type CableOptions, type CableShape, type CableStyle, type PacketStyle } from "./draw";
