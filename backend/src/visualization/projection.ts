/**
 * Projects high-dimensional embeddings down to 3D with PCA, so the axes are the directions the
 * data actually varies in most and any cluster you see is real structure.
 *
 * Components are found by power iteration: repeatedly multiplying a guess by the covariance
 * matrix pulls it towards the dominant direction. The covariance matrix itself (768x768) is never
 * built; each pass walks the vectors instead, which is both faster and lighter.
 */

const ITERATIONS = 40;
/** Scaling ignores the most extreme 1% so a few outliers can't squash everything into the centre. */
const OUTLIER_PERCENTILE = 0.99;

export type Point3D = [number, number, number];

function dot(a: number[], b: number[]): number {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += a[i]! * b[i]!;
  return total;
}

function normalize(vector: number[]): number[] {
  const length = Math.hypot(...vector) || 1;
  return vector.map((value) => value / length);
}

/** Removes any part of `vector` that points along vectors it should be orthogonal to. */
function orthogonalize(vector: number[], against: number[][]): number[] {
  const result = [...vector];
  for (const other of against) {
    const overlap = dot(result, other);
    for (let i = 0; i < result.length; i++) result[i]! -= overlap * other[i]!;
  }
  return result;
}

function meanVector(vectors: number[][]): number[] {
  const dimensions = vectors[0]?.length ?? 0;
  const mean = new Array<number>(dimensions).fill(0);
  for (const vector of vectors) {
    for (let i = 0; i < dimensions; i++) mean[i]! += vector[i]!;
  }
  return mean.map((total) => total / vectors.length);
}

/** Divides each axis by its 99th-percentile magnitude and clamps, giving roughly -1..1 per axis. */
function scaleToUnitCube(points: Point3D[]): Point3D[] {
  const scales = ([0, 1, 2] as const).map((axis) => {
    const magnitudes = points.map((point) => Math.abs(point[axis])).sort((a, b) => a - b);
    return magnitudes[Math.floor(magnitudes.length * OUTLIER_PERCENTILE)] || 1;
  });
  const clamp = (value: number) => Math.max(-1.2, Math.min(1.2, value));
  return points.map(
    (point) => point.map((value, axis) => Number(clamp(value / scales[axis]!).toFixed(3))) as Point3D,
  );
}

export function projectTo3D(vectors: number[][]): Point3D[] {
  if (vectors.length === 0) return [];

  const mean = meanVector(vectors);
  const centered = vectors.map((vector) => vector.map((value, i) => value - mean[i]!));

  const components: number[][] = [];
  for (let k = 0; k < 3; k++) {
    // A fixed starting guess keeps runs reproducible; any vector not already covered works.
    let candidate = normalize(centered[0]!.map((value, i) => value + Math.sin(i * (k + 1))));
    for (let iteration = 0; iteration < ITERATIONS; iteration++) {
      const next = new Array<number>(mean.length).fill(0);
      for (const vector of centered) {
        const weight = dot(vector, candidate);
        for (let i = 0; i < next.length; i++) next[i]! += weight * vector[i]!;
      }
      candidate = normalize(orthogonalize(next, components));
    }
    components.push(candidate);
  }

  const points = centered.map(
    (vector) => components.map((component) => dot(vector, component)) as Point3D,
  );
  return scaleToUnitCube(points);
}
