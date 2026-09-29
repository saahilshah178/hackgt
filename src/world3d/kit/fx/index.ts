/*
 * The kit's effects, for the game host and the gallery: weather particles (rendered by <WorldScene>), the goal beacon
 * (rendered by <WorldScene> unless `beacon={false}`; also exported so a host can place or toggle its own), and the
 * interaction ring and reward burst the game places around moments.
 */
export { WeatherFx } from "./Weather";
export { GoalBeacon, InteractRing, RewardBurst, type GoalBeaconProps, type InteractRingProps, type RewardBurstProps } from "./markers";
