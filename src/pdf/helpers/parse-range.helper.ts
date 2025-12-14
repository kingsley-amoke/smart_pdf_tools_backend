export function parseRange(range: string, totalPages: number): number[] {
  const indices: number[] = [];

  if (range.includes('-')) {
    // Range like "1-3"
    const [start, end] = range.split('-').map((n) => parseInt(n.trim()));

    if (
      isNaN(start) ||
      isNaN(end) ||
      start < 1 ||
      end > totalPages ||
      start > end
    ) {
      return [];
    }

    for (let i = start; i <= end; i++) {
      indices.push(i - 1); // Convert to 0-indexed
    }
  } else {
    // Single page like "5"
    const page = parseInt(range.trim());

    if (isNaN(page) || page < 1 || page > totalPages) {
      return [];
    }

    indices.push(page - 1); // Convert to 0-indexed
  }

  return indices;
}
