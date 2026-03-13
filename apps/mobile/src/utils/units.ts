export function kmhToMph(kmh: number): number {
  return kmh * 0.621371;
}

export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

export function formatSpeed(kmh: number, unit: 'kmh' | 'mph'): string {
  return unit === 'mph' ? kmhToMph(kmh).toFixed(0) : kmh.toFixed(0);
}

export function formatTemp(c: number, unit: 'celsius' | 'fahrenheit'): string {
  return unit === 'fahrenheit' ? celsiusToFahrenheit(c).toFixed(0) : c.toFixed(0);
}
