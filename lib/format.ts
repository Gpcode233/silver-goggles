export function formatCredits(value: number): string {
  return Number(value).toFixed(2);
}

export function formatUsd(value: number): string {
  return `$${Number(value).toFixed(2)}`;
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}
