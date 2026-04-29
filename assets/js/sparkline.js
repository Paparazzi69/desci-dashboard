// Generates inline SVG sparklines from a numeric series. No chart library:
// keeping a single SVG path string keeps DOM tiny when we render 11 rows.

export function sparklineSVG(data, { positive = true, w = 80, h = 28 } = {}) {
  if (!data || data.length < 2) {
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"></svg>`;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const pathD = 'M ' + pts.join(' L ');
  const fillD = pathD + ` L ${w},${h} L 0,${h} Z`;
  const stroke = positive ? 'var(--green)' : 'var(--red)';
  const fill = positive ? 'oklch(0.78 0.19 155 / 0.12)' : 'oklch(0.65 0.2 22 / 0.1)';
  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;overflow:visible">
      <path d="${fillD}" fill="${fill}"/>
      <path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>
  `;
}

export function largeChartSVG(data, { positive = true, h = 120 } = {}) {
  const w = 460;
  if (!data || data.length < 2) {
    return `<svg width="100%" viewBox="0 0 ${w} ${h}"></svg>`;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const pathD = 'M ' + pts.join(' L ');
  const fillD = pathD + ` L ${w},${h} L 0,${h} Z`;
  const stroke = positive ? 'var(--green)' : 'var(--red)';
  const id = 'lc' + Math.random().toString(36).slice(2, 6);
  return `
    <svg width="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="display:block">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${stroke}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="${stroke}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${fillD}" fill="url(#${id})"/>
      <path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>
  `;
}
