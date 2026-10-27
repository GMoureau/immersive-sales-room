// Shared types of the 3D world: what a room offers the world, and what the avatar can do.
import type * as THREE from 'three';

export type Vec3 = [number, number, number];
export type Status = 'groen' | 'oranje' | 'rood';

/** Something you can point at or click: a door, a column, a wall card, a slicer. */
export type Doel = object;

export interface CameraDoel {
  pos: Vec3;
  kijk: Vec3;
}

/**
 * A room the world can show. Methods use method syntax on purpose: each room
 * narrows `doel` to its own kind of target (a door, a tree node, a card).
 */
export interface Ruimte {
  groep: THREE.Group;
  /** Fog density in this room. */
  mist?: number;
  /** Default vertical look angle when looking over the shoulder. */
  pitch?: number;
  /** Where the avatar stands when we look over its shoulder (x, z); without it the camera follows cameraDoel. */
  schouder?: [number, number];
  hint?: string;
  readonly klikbaar: THREE.Object3D[];
  cameraDoel?(): CameraDoel;
  hover?(doel: Doel | null): void;
  beweeg?(doel: Doel | null, treffer: THREE.Intersection | null): void;
  klik?(doel: Doel): void;
  update?(t: number, dt: number): void;
}

/** The avatar as the rooms use it (built in avatar.ts). */
export interface Avatar {
  readonly positie: THREE.Vector3;
  kijker?: () => THREE.Vector3;
  update(dt: number): void;
  zet(x: number, z: number, richting?: number): void;
  richt(richting: number): void;
  staOp(): Promise<void>;
  zitNeer(): void;
  loop(punten: THREE.Vector3[]): Promise<void>;
  kijkNaar(punt: THREE.Vector3 | null): void;
  wijs(punt: THREE.Vector3): Promise<void>;
  reageer(status: Status): void;
  overschouw(punten: THREE.Vector3[]): void;
}
