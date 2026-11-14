/**
 * Minimal types for d3-force-3d 3.x — only the surface scripts/bake/layout-graph.ts uses. The
 * package ships no types, and @types/d3-force is 2D-only. Bake-time only: never imported by app code.
 */
declare module "d3-force-3d" {
  export interface SimulationNode {
    index?: number;
    x?: number;
    y?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    fx?: number | null;
    fy?: number | null;
    fz?: number | null;
  }

  export interface SimulationLink<N> {
    source: string | number | N;
    target: string | number | N;
    index?: number;
  }

  export interface Force<N> {
    (alpha: number): void;
    initialize?(nodes: N[], random: () => number, numDimensions: number): void;
  }

  type Accessor<T, V> = number | ((d: T, i: number, all: T[]) => V);

  export interface Simulation<N extends SimulationNode> {
    tick(iterations?: number): this;
    stop(): this;
    restart(): this;
    nodes(): N[];
    nodes(nodes: N[]): this;
    alpha(): number;
    alpha(alpha: number): this;
    alphaMin(): number;
    alphaMin(min: number): this;
    alphaDecay(): number;
    alphaDecay(decay: number): this;
    alphaTarget(): number;
    alphaTarget(target: number): this;
    velocityDecay(): number;
    velocityDecay(decay: number): this;
    randomSource(): () => number;
    randomSource(source: () => number): this;
    force(name: string): Force<N> | undefined;
    force(name: string, force: Force<N> | null): this;
  }

  export function forceSimulation<N extends SimulationNode>(nodes?: N[], numDimensions?: 1 | 2 | 3): Simulation<N>;

  export interface LinkForce<N, L extends SimulationLink<N>> extends Force<N> {
    links(): L[];
    links(links: L[]): this;
    id(id: (node: N, i: number, nodes: N[]) => string | number): this;
    distance(distance: Accessor<L, number>): this;
    strength(strength: Accessor<L, number>): this;
    iterations(iterations: number): this;
  }
  export function forceLink<N extends SimulationNode, L extends SimulationLink<N>>(links?: L[]): LinkForce<N, L>;

  export interface ManyBodyForce<N> extends Force<N> {
    strength(strength: Accessor<N, number>): this;
    theta(theta: number): this;
    distanceMin(distance: number): this;
    distanceMax(distance: number): this;
  }
  export function forceManyBody<N extends SimulationNode>(): ManyBodyForce<N>;

  export interface PositionForce<N> extends Force<N> {
    strength(strength: Accessor<N, number>): this;
  }
  export function forceX<N extends SimulationNode>(x?: Accessor<N, number>): PositionForce<N>;
  export function forceY<N extends SimulationNode>(y?: Accessor<N, number>): PositionForce<N>;
  export function forceZ<N extends SimulationNode>(z?: Accessor<N, number>): PositionForce<N>;

  export interface CollideForce<N> extends Force<N> {
    radius(radius: Accessor<N, number>): this;
    strength(strength: number): this;
    iterations(iterations: number): this;
  }
  export function forceCollide<N extends SimulationNode>(radius?: Accessor<N, number>): CollideForce<N>;
}
