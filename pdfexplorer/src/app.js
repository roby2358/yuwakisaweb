// Generic explorer wiring: build controls from the selected distribution's
// param specs, sample its pdf/cdf, hand the traces to Plotly, show its stats.

(function (ns) {
  const { distributions, distributionOrder, inverseCdf } = ns;

  const PLOT_POINTS = 401;

  const COLORS = {
    background: '#2b2b2b',
    cdf: '#ffffff',
    pdf: '#5fa8ff',
    grid: '#444444',
    text: '#dddddd',
  };

  const distSelect = document.getElementById('distribution');
  const noteEl = document.getElementById('dist-note');
  const applicationsEl = document.getElementById('dist-applications');
  const controlsEl = document.getElementById('controls');
  const statsEl = document.getElementById('stats');
  const intervalEl = document.getElementById('confidence-interval');
  const confSlider = document.getElementById('confidence-slider');
  const confNumber = document.getElementById('confidence-number');
  const plotEl = document.getElementById('plot');

  let currentKey = distributionOrder[0];

  // --- sampling -----------------------------------------------------------

  function sample(dist, params) {
    const { min, max } = dist.support(params);
    const xs = [];
    const pdf = [];
    const cdf = [];
    for (let i = 0; i < PLOT_POINTS; i++) {
      const x = min + ((max - min) * i) / (PLOT_POINTS - 1);
      const density = dist.pdf(x, params);
      xs.push(x);
      pdf.push(Number.isFinite(density) ? density : null);
      cdf.push(dist.cdf(x, params));
    }
    return { xs, pdf, cdf };
  }

  // --- controls -----------------------------------------------------------

  // Keep a range slider and a number box mirroring each other, firing onChange.
  function syncPair(slider, number, onChange) {
    slider.addEventListener('input', () => {
      number.value = slider.value;
      onChange();
    });
    number.addEventListener('input', () => {
      slider.value = number.value;
      onChange();
    });
  }

  function readParams(dist) {
    const params = {};
    for (const spec of dist.params) {
      const slider = document.getElementById(`slider-${spec.key}`);
      params[spec.key] = Number(slider.value);
    }
    return params;
  }

  // The selected distribution paired with its current slider values — the input
  // every render step works from.
  function currentState() {
    const dist = distributions[currentKey];
    return { dist, params: readParams(dist) };
  }

  function buildParamRow(spec) {
    const row = document.createElement('div');
    row.className = 'control';

    const label = document.createElement('label');
    label.textContent = spec.label;
    label.htmlFor = `slider-${spec.key}`;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = `slider-${spec.key}`;
    slider.min = spec.min;
    slider.max = spec.max;
    slider.step = spec.step;
    slider.value = spec.value;

    const number = document.createElement('input');
    number.type = 'number';
    number.id = `number-${spec.key}`;
    number.min = spec.min;
    number.max = spec.max;
    number.step = spec.step;
    number.value = spec.value;

    syncPair(slider, number, render);

    row.append(label, slider, number);
    return row;
  }

  function buildControls(dist) {
    controlsEl.replaceChildren(...dist.params.map(buildParamRow));
  }

  // --- stats --------------------------------------------------------------

  function formatStat(value) {
    return Number.isFinite(value) ? value.toFixed(4) : '—';
  }

  function statRow(name, value) {
    const item = document.createElement('div');
    item.className = 'stat';
    const k = document.createElement('span');
    k.className = 'stat-name';
    k.textContent = name;
    const v = document.createElement('span');
    v.className = 'stat-value';
    v.textContent = formatStat(value);
    item.append(k, v);
    return item;
  }

  function renderRows(container, rows) {
    container.replaceChildren(...rows.map(([name, value]) => statRow(name, value)));
  }

  function renderStats(stats) {
    renderRows(statsEl, [
      ['Mean', stats.mean],
      ['Mode', stats.mode],
      ['Variance', stats.variance],
    ]);
  }

  // --- confidence ---------------------------------------------------------

  // x-values bounding the interval between the lower and upper percentiles.
  function quantileBounds(dist, params, lowerP, upperP) {
    const { min, max } = dist.support(params);
    const cdf = (x) => dist.cdf(x, params);
    return {
      low: inverseCdf(cdf, lowerP, min, max),
      high: inverseCdf(cdf, upperP, min, max),
    };
  }

  function renderConfidence() {
    const { dist, params } = currentState();
    const level = Number(confSlider.value);
    // Split the excluded mass evenly between the two tails. Percent labels are
    // computed in integer space so they read cleanly (e.g. 2.5 %, not 2.5000…2).
    const lowerPct = (100 - level) / 2;
    const upperPct = 100 - lowerPct;
    const { low, high } = quantileBounds(dist, params, lowerPct / 100, upperPct / 100);
    renderRows(intervalEl, [
      [`Lower (${lowerPct}%)`, low],
      [`Upper (${upperPct}%)`, high],
    ]);
  }

  // --- plot ---------------------------------------------------------------

  function plotLayout() {
    const axis = {
      gridcolor: COLORS.grid,
      zerolinecolor: COLORS.grid,
      color: COLORS.text,
    };
    return {
      paper_bgcolor: COLORS.background,
      plot_bgcolor: COLORS.background,
      font: { color: COLORS.text },
      margin: { l: 56, r: 56, t: 20, b: 48 },
      xaxis: { ...axis, title: 'x' },
      yaxis: { ...axis, title: 'cumulative', range: [0, 1], dtick: 0.1 },
      yaxis2: {
        ...axis,
        title: 'density',
        overlaying: 'y',
        side: 'right',
        rangemode: 'tozero',
        showgrid: false,
      },
      legend: { x: 0.02, y: 0.98, bgcolor: 'rgba(0,0,0,0)' },
      showlegend: true,
    };
  }

  function render() {
    const { dist, params } = currentState();
    const { xs, pdf, cdf } = sample(dist, params);

    const traces = [
      {
        x: xs,
        y: cdf,
        name: 'CDF',
        mode: 'lines',
        line: { color: COLORS.cdf, width: 2 },
      },
      {
        x: xs,
        y: pdf,
        name: 'PDF',
        mode: 'lines',
        yaxis: 'y2',
        line: { color: COLORS.pdf, width: 2, dash: 'dot' },
      },
    ];

    Plotly.react(plotEl, traces, plotLayout(), {
      responsive: true,
      displayModeBar: false,
    });
    renderStats(dist.stats(params));
    renderConfidence();
  }

  // --- bootstrap ----------------------------------------------------------

  function renderApplications(dist) {
    applicationsEl.replaceChildren(
      ...dist.applications.map((text) => {
        const item = document.createElement('li');
        item.textContent = text;
        return item;
      }),
    );
  }

  function selectDistribution(key) {
    currentKey = key;
    const dist = distributions[key];
    noteEl.textContent = dist.note;
    renderApplications(dist);
    buildControls(dist);
    render();
  }

  function init() {
    distSelect.replaceChildren(
      ...distributionOrder.map((key) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = distributions[key].label;
        return option;
      }),
    );
    distSelect.value = currentKey;
    distSelect.addEventListener('change', () => selectDistribution(distSelect.value));
    syncPair(confSlider, confNumber, renderConfidence);
    selectDistribution(currentKey);
  }

  init();
})((globalThis.PDF = globalThis.PDF || {}));
