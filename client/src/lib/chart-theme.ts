function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function hslToHex(hsl: string): string {
  const parts = hsl.split(/\s+/);
  if (parts.length < 3) return "#888888";
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;

  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function getChartColors() {
  const bg = getCSSVar("--card");
  const fg = getCSSVar("--foreground");
  const muted = getCSSVar("--muted-foreground");
  const border = getCSSVar("--border");

  return {
    primary: hslToHex(getCSSVar("--chart-1")),
    secondary: hslToHex(getCSSVar("--chart-2")),
    grid: hslToHex(getCSSVar("--border")),
    axis: hslToHex(getCSSVar("--muted-foreground")),
    tooltip: {
      bg: hslToHex(bg),
      border: hslToHex(border),
      text: hslToHex(fg),
      muted: hslToHex(muted),
    },
    series: [
      hslToHex(getCSSVar("--chart-1")),
      hslToHex(getCSSVar("--chart-2")),
      hslToHex(getCSSVar("--chart-3")),
      hslToHex(getCSSVar("--chart-4")),
      hslToHex(getCSSVar("--chart-5")),
    ],
  };
}
