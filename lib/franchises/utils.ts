export function toPercentage(completed: number, total: number) {
  if (total === 0) {
    return 0;
  }

  // Round to one decimal place so API responses can surface values like 66.7%.
  return Math.round((completed / total) * 1000) / 10;
}
