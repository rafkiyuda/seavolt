/* SeaVolt – mobile-first web app (demo). All data is simulated in-browser. */
(() => {
  'use strict';

  // ---- Constants taken from the SeaVolt business proposal --------------------
  const FEE_PER_TRIP = 85000;        // Rp per trip
  const PACK_KWH = 2.56, PACKS = 4;  // 4 x 2.56 kWh = 10.24 kWh
  const CAPACITY_KWH = PACK_KWH * PACKS;
  const TRIP_KWH = 8;                // energy per trip
  const PETROL_L_PER_TRIP = 8;       // litres replaced per trip
  const CO2_KG_PER_TRIP = 10.8;      // kg CO2 avoided per trip
  const RANGE_KM_FULL = 58;          // demo: range at 100%
  const PETROL_PRICE = 13000;        // demo assumption, Rp/L (unsubsidised retail)
  const RETURN_ALERT = 30;           // % return alert

  const STATIONS = [
    { id: 1, name: 'Dock Station Cilincing', area: 'Cilincing, Jakarta Utara', km: 1.2, x: 46, y: 52, ready: 52, slots: 3, solar: false },
    { id: 2, name: 'Dock Station Muara Angke', area: 'Penjaringan, Jakarta Utara', km: 6.8, x: 25, y: 30, ready: 38, slots: 5, solar: true },
    { id: 3, name: 'Dock Station Kali Baru', area: 'Cilincing, Jakarta Utara', km: 3.4, x: 70, y: 36, ready: 21, slots: 2, solar: false },
    { id: 4, name: 'Dock Station Muara Baru', area: 'Penjaringan, Jakarta Utara', km: 9.1, x: 18, y: 68, ready: 44, slots: 4, solar: true },
  ];

  const FLEET = [
    { id: 'B01', name: 'Boat 01', crew: 'Pak Casmadi', pct: 82, trips: 24 },
    { id: 'B02', name: 'Boat 02', crew: 'Agus', pct: 67, trips: 21 },
    { id: 'B03', name: 'Boat 03', crew: 'Ratam', pct: 45, trips: 19 },
    { id: 'B04', name: 'Boat 04', crew: 'Joko', pct: 91, trips: 26 },
    { id: 'B05', name: 'Boat 05', crew: 'Slamet', pct: 28, trips: 17 },
    { id: 'B06', name: 'Boat 06', crew: 'Dedi', pct: 73, trips: 22 },
  ];

  const PLANS = [
    { id: 'trip', name: 'Per Trip', desc: 'Bayar tiap trip, tanpa komitmen', trips: 1, price: FEE_PER_TRIP },
    { id: 'week', name: 'Paket Mingguan', desc: '5 trip / minggu (hemat 6%)', trips: 5, price: 400000 },
    { id: 'month', name: 'Paket Bulanan', desc: '20 trip / bulan (hemat 12%)', trips: 20, price: 1500000 },
    { id: 'quarter', name: 'Paket 3 Bulan', desc: '60 trip (hemat 16%)', trips: 60, price: 4300000 },
  ];

  // ---- State (persisted in localStorage) ------------------------------------
  const defaults = () => ({
    role: 'fisher',
    battery: 82,
    plan: 'trip',
    credits: 0,
    stationId: 1,
    booking: null,
    sos: false,
    share: false,
    alertsOn: true,
    tripFilter: '30',
    trips: seedTrips(),
    help: [],
    sailing: false, sailKm: 0, sailSec: 0, swapStep: 0, points: 120,
  });
  function seedTrips() {
    const out = [], now = Date.now();
    const kms = [24, 18, 32, 16, 28, 22, 26, 20, 30, 19, 27, 23];
    for (let i = 0; i < 12; i++) {
      out.push({ ts: now - (i * 2.4 + 0.5) * 864e5, km: kms[i], fee: FEE_PER_TRIP, method: ['Tunai', 'QRIS', 'Transfer'][i % 3] });
    }
    return out;
  }
  let S;
  try { S = Object.assign(defaults(), JSON.parse(localStorage.getItem('seavolt') || '{}')); } catch { S = defaults(); }
  const save = () => { try { localStorage.setItem('seavolt', JSON.stringify(S)); } catch {} };

  // ---- Helpers ---------------------------------------------------------------
  const $ = (s, el = document) => el.querySelector(s);
  const rp = n => 'Rp' + Math.round(n).toLocaleString('id-ID');
  const num = (n, d = 0) => n.toLocaleString('id-ID', { maximumFractionDigits: d });
  const rangeKm = () => Math.round(RANGE_KM_FULL * S.battery / 100);
  const kwhLeft = () => (CAPACITY_KWH * S.battery / 100);
  const fmtDate = ts => new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const batClass = p => p >= 50 ? '' : p > RETURN_ALERT ? 'mid' : 'low';
  const station = () => STATIONS.find(s => s.id === S.stationId) || STATIONS[0];
  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400);
  }
  const savingPerTrip = () => PETROL_L_PER_TRIP * PETROL_PRICE - FEE_PER_TRIP;

  // pseudo QR (decorative demo – NOT a scannable payment code)
  function fakeQR(seed) {
    const n = 25, cell = 8; let h = 0;
    for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const rnd = () => (h = (h * 1664525 + 1013904223) >>> 0) / 4294967296;
    const finder = (x, y) => `<rect x="${x * cell}" y="${y * cell}" width="${7 * cell}" height="${7 * cell}" fill="#0b2a5b"/><rect x="${(x + 1) * cell}" y="${(y + 1) * cell}" width="${5 * cell}" height="${5 * cell}" fill="#fff"/><rect x="${(x + 2) * cell}" y="${(y + 2) * cell}" width="${3 * cell}" height="${3 * cell}" fill="#0b2a5b"/>`;
    let r = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const inF = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
      if (!inF && rnd() > 0.52) r += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="#0b2a5b"/>`;
    }
    return `<svg class="qr" viewBox="0 0 ${n * cell} ${n * cell}" role="img" aria-label="Kode QR demo"><rect width="100%" height="100%" fill="#fff"/>${r}${finder(0, 0)}${finder(n - 7, 0)}${finder(0, n - 7)}</svg>`;
  }

  // ---- Routes ----------------------------------------------------------------
  const TABS_FISHER = [
    ['home', '🏠', 'Beranda'], ['stations', '📍', 'Stasiun'], ['pay', '💳', 'Bayar'], ['trips', '📊', 'Trip'], ['more', '☰', 'Lainnya'],
  ];
  const TABS_OWNER = [
    ['fleet', '⛵', 'Armada'], ['stations', '📍', 'Stasiun'], ['pay', '💳', 'Tagihan'], ['impact', '🌱', 'Dampak'], ['more', '☰', 'Lainnya'],
  ];
  const routes = {
    home: { title: null, dark: true, render: vHome },
    stations: { title: 'Stasiun Dock', render: vStations },
    pay: { title: 'Pembayaran', render: vPay },
    trips: { title: 'Riwayat Trip', render: vTrips },
    safety: { title: 'Keamanan', render: vSafety },
    fleet: { title: 'Armada Saya', render: vFleet },
    impact: { title: 'Dampak & ESG', render: vImpact },
    help: { title: 'Bantuan', render: vHelp },
    more: { title: 'Lainnya', render: vMore },
  };

  function currentRoute() {
    const r = (location.hash || '').replace('#/', '').split('?')[0];
    if (routes[r]) return r;
    return S.role === 'owner' ? 'fleet' : 'home';
  }

  function render() {
    const name = currentRoute(), route = routes[name];
    const top = $('#topbar'), view = $('#view'), tabs = $('#tabbar');
    const isRoot = ['home', 'fleet', 'stations', 'pay', 'trips', 'impact', 'more'].includes(name);
    top.innerHTML = `
      ${isRoot && route.title === null || name === 'fleet'
        ? `<button class="icon-btn" data-go="more" aria-label="Menu">☰</button>`
        : isRoot ? `<span style="width:38px"></span>` : `<button class="icon-btn" data-go="back" aria-label="Kembali">←</button>`}
      ${route.title === null || name === 'fleet'
        ? `<div class="brand"><img src="assets/logo.png" alt="SeaVolt"></div>`
        : `<h1>${route.title}</h1>`}
      <button class="icon-btn" data-go="safety" aria-label="Notifikasi">🔔${S.battery <= RETURN_ALERT || S.sos ? '<i class="dot"></i>' : ''}</button>`;
    view.className = 'view' + (route.dark ? ' dark' : '');
    view.innerHTML = route.render();
    view.scrollTop = 0;
    const list = S.role === 'owner' ? TABS_OWNER : TABS_FISHER;
    tabs.innerHTML = list.map(([id, ic, label]) =>
      `<a href="#/${id}" class="${id === name ? 'on' : ''}"><span>${ic}</span>${label}</a>`).join('');
    bind(name);
  }

  // ---- Views -----------------------------------------------------------------
  function gauge(p) {
    const C = 2 * Math.PI * 90, arc = C * 0.75, filled = arc * p / 100;
    const col = p > RETURN_ALERT ? '#22c55e' : '#ef4444';
    return `<div class="gauge"><svg viewBox="0 0 220 220">
      <circle cx="110" cy="110" r="90" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="16" stroke-linecap="round" stroke-dasharray="${arc} ${C}"/>
      <circle cx="110" cy="110" r="90" fill="none" id="g-arc" stroke="${col}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${filled} ${C}"/></svg>
      <div class="center"><div class="pct" id="g-pct">${Math.round(p)}%</div><div class="sub" id="g-sub">≈ ${rangeKm()} km</div></div></div>`;
  }

  function vHome() {
    const per = S.battery / 100 * CAPACITY_KWH / PACKS;
    const tripsLeft = Math.max(0, kwhLeft() / TRIP_KWH);
    const low = S.battery <= RETURN_ALERT;
    return `
      <div class="gauge-wrap">${gauge(S.battery)}
        <svg class="waves" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true"><path d="M0 20Q25 5 50 20T100 20T150 20T200 20T250 20T300 20T350 20T400 20V40H0Z" fill="rgba(16,196,224,.25)"/><path d="M0 26Q25 14 50 26T100 26T150 26T200 26T250 26T300 26T350 26T400 26V40H0Z" fill="rgba(10,132,214,.35)"/></svg></div>
      <div class="pills">
        <div class="pill"><b>3.0 kW</b><small>Motor outboard</small></div>
        <div class="pill"><b>${(tripsLeft * 3).toFixed(1)} jam</b><small>Sisa waktu berlayar</small></div>
      </div>
      <button class="btn ${S.sailing ? 'danger' : 'blue'}" data-act="${S.sailing ? 'end-trip' : 'start-trip'}" style="margin-bottom:12px" ${!S.sailing && S.battery <= 20 ? 'disabled' : ''}>${S.sailing ? '⏹ Akhiri trip' : S.battery <= 20 ? 'Baterai terlalu rendah – tukar dulu' : '⛵ Mulai melaut'}</button>
      <div class="card telem ${S.sailing ? 'live' : ''}">
        <div class="row between"><h2>Telemetri IoT</h2><span class="chip ${S.sailing ? 'ok' : ''}" id="t-state">${S.sailing ? '● LIVE' : 'Standby'}</span></div>
        <div class="grid3">
          <div class="stat"><b id="t-spd">${S.sailing ? '8,0' : '0'}</b><small>knot</small></div>
          <div class="stat"><b id="t-amp">${S.sailing ? '58' : '0'}</b><small>Ampere</small></div>
          <div class="stat"><b id="t-volt">${(48 + S.battery * 0.052).toFixed(1)}</b><small>Volt</small></div>
          <div class="stat"><b id="t-temp">${telTemp().toFixed(0)}°C</b><small>Suhu pack</small></div>
          <div class="stat"><b id="t-km">${S.sailKm.toFixed(1)}</b><small>km trip ini</small></div>
          <div class="stat"><b id="t-min">${Math.floor(S.sailSec / 60)}</b><small>menit</small></div>
        </div>
      </div>
      ${seaCard()}
      ${low && S.alertsOn ? `<div class="alert warn"><span>⚠️</span><div><b>Waktunya kembali ke dermaga</b>Baterai ${Math.round(S.battery)}%. Cadangan keselamatan ~20% tidak dipakai outlet aksesoris.</div></div>` : ''}
      <div class="card">
        <div class="row between"><h2>Paket baterai</h2><span class="chip ${low ? 'warn' : 'ok'}">${low ? 'Segera tukar' : 'Sehat'}</span></div>
        <div class="packs">${[0, 1, 2, 3].map(i => `<div class="pack"><b>${Math.round(per / PACK_KWH * 100)}%</b>Pack ${i + 1}</div>`).join('')}</div>
        <p class="muted small" style="margin-top:8px">${num(kwhLeft(), 1)} / ${CAPACITY_KWH.toFixed(2)} kWh • 4 × 51,2 V × 50 Ah LFP • suhu 31°C</p>
      </div>
      <div class="card">
        <h2>Stasiun terdekat</h2>
        <div class="row"><div class="grow"><b>${station().name}</b><div class="muted">${station().km} km • ${station().ready} paket siap</div></div>
        <button class="btn sm blue" data-go="stations">Tukar</button></div>
      </div>
      <div class="grid2">
        <div class="stat"><b>${S.trips.length}</b><small>Trip tercatat</small></div>
        <div class="stat"><b>${rp(S.trips.length * savingPerTrip())}</b><small>Estimasi hemat vs bensin</small></div>
      </div>
      <p class="muted small" style="text-align:center">Demo: baterai terkuras ±20× lebih cepat saat melaut.</p>`;
  }

  // ---- Live trip simulation ---------------------------------------------------
  function telTemp() { return 29 + (S.sailing ? 6 + (100 - S.battery) * 0.07 : 0); }
  function seaCard() {
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    const wave = 0.5 + 0.6 * (1 + Math.sin((h - 4) / 24 * 2 * Math.PI)) / 2 + 0.2;
    const wind = Math.round(8 + 6 * (1 + Math.sin((h - 9) / 24 * 2 * Math.PI)) / 2);
    const ok = wave < 1.0 && wind < 15, mid = wave < 1.5 && wind < 22;
    return `<div class="card"><div class="row between"><h2>Kondisi laut</h2><span class="chip ${ok ? 'ok' : mid ? 'warn' : 'bad'}">${ok ? 'Layak melaut' : mid ? 'Waspada' : 'Tunda melaut'}</span></div>
      <div class="grid3"><div class="stat"><b>${wave.toFixed(1)} m</b><small>Tinggi gelombang</small></div><div class="stat"><b>${wind} kn</b><small>Angin</small></div><div class="stat"><b>${Math.round(S.battery / 100 * 3 * 60)} mnt</b><small>Daya tersisa</small></div></div>
      <p class="muted small" style="margin-top:6px">Data simulasi, bukan prakiraan resmi BMKG.</p></div>`;
  }
  function updateLive() {
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    const arc = 2 * Math.PI * 90 * 0.75, C = 2 * Math.PI * 90, a = document.getElementById('g-arc');
    if (a) { a.setAttribute('stroke-dasharray', `${arc * S.battery / 100} ${C}`); a.setAttribute('stroke', S.battery > RETURN_ALERT ? '#22c55e' : '#ef4444'); }
    set('g-pct', Math.round(S.battery) + '%'); set('g-sub', '≈ ' + rangeKm() + ' km');
    set('t-spd', S.speed.toFixed(1).replace('.', ',')); set('t-amp', Math.round(S.amps)); set('t-volt', (48 + S.battery * 0.052).toFixed(1));
    set('t-temp', telTemp().toFixed(0) + '°C'); set('t-km', S.sailKm.toFixed(1)); set('t-min', Math.floor(S.sailSec / 60));
    document.querySelectorAll('.pack b').forEach(b => b.textContent = Math.round(S.battery) + '%');
  }
  S.speed = 0; S.amps = 0; let warned = false;
  setInterval(() => {
    if (!S.sailing) return;
    S.battery = Math.max(0, S.battery - 0.06);
    S.speed = 8 + Math.sin(Date.now() / 4000) * 1.5; S.amps = 56 + Math.sin(Date.now() / 1500) * 4;
    S.sailKm += S.speed * 1.852 / 3600 * 20; S.sailSec += 20;
    if (S.battery <= RETURN_ALERT && !warned && S.alertsOn) { warned = true; toast('⚠️ Baterai ' + Math.round(S.battery) + '% – kembali ke dermaga'); }
    if (S.battery <= 20) { act('end-trip', true); return; }
    save(); if (currentRoute() === 'home') updateLive();
  }, 1000);

  function mapSVG() {
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 0H100V28C86 24 74 30 62 26C50 22 42 30 30 28C18 26 8 32 0 30Z" fill="#d9c9a5"/>
      <path d="M0 0H100V20C86 17 74 22 62 19C50 16 42 22 30 20C18 18 8 23 0 21Z" fill="#c5b28a"/>
      <path d="M8 90C30 78 50 84 70 74S92 62 100 66" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".8" stroke-dasharray="2 2"/></svg>`;
  }

  function vStations() {
    const sel = station();
    const pins = STATIONS.map(s => `<span class="pin ${s.id === sel.id ? 'sel' : ''}" style="left:${s.x}%;top:${s.y}%" data-pick="${s.id}" role="button" aria-label="${s.name}">📍</span>`).join('');
    const list = STATIONS.slice().sort((a, b) => a.km - b.km).map(s => `
      <div class="st ${s.id === sel.id ? 'sel' : ''}" data-pick="${s.id}">
        <div class="ic">⚡</div>
        <div class="grow"><b>${s.name}</b><div class="muted small">${s.area}</div>
          <div class="muted small">${s.km} km • ${s.ready} paket siap • antrean ${s.slots} slot ${s.solar ? '• ☀️ surya' : ''}</div></div>
      </div>`).join('');
    const b = S.booking;
    return `
      <div class="map">${mapSVG()}${pins}<span class="boat-dot" style="left:52%;top:62%">⛵</span></div>
      ${b ? swapFlow(b) : ''}
      <div class="card"><div class="row"><div class="grow"><b>${sel.name}</b><div class="muted small">${sel.km} km • ${sel.ready} paket siap</div></div>
        <button class="btn sm" data-act="book" ${b ? 'disabled' : ''}>Pesan slot</button></div></div>
      <p class="sec-title">Semua stasiun</p>${list}`;
  }

  function swapFlow(b) {
    const labels = ['Slot dipesan', 'Tiba di dermaga', 'Scan QR perahu', 'Tukar 4 pack'];
    const btn = ['Saya sudah tiba', 'Scan QR perahu', 'Mulai tukar', ''][S.swapStep - 1];
    return `<div class="card"><div class="row between"><h2>Tukar baterai</h2><span class="chip">${STATIONS.find(s => s.id === b.stationId).name.replace('Dock Station ', '')} • ${b.time}</span></div>
      ${labels.map((l, i) => `<div class="step ${S.swapStep > i + 1 ? 'done' : ''}"><span class="n">${S.swapStep > i + 1 ? '✓' : i + 1}</span><div class="grow"><b>${l}</b>${S.swapStep === i + 1 && i === 2 ? '<div style="margin-top:6px">' + fakeQR('BOAT-B01') + '</div>' : ''}${S.swapStep === 4 && i === 3 ? '<div class="bar" style="margin-top:8px"><i class="swap-anim"></i></div><div class="muted small">Melepas pack lama & memasang 4 pack terisi penuh…</div>' : ''}</div></div>`).join('')}
      <div class="row" style="margin-top:6px">${btn ? `<button class="btn" data-act="swap-next">${btn}</button>` : ''}<button class="btn ghost sm" data-act="cancel-booking">Batal</button></div></div>`;
  }

  function vPay() {
    const owner = S.role === 'owner';
    if (owner) {
      const trips = FLEET.reduce((a, f) => a + f.trips, 0);
      return `
        <div class="card"><h3>Tagihan bulan ini</h3><div class="big">${rp(trips * FEE_PER_TRIP)}</div>
          <p class="muted small">${trips} trip • ${FLEET.length} perahu • satu invoice gabungan</p>
          <div style="margin-top:10px"><button class="btn blue" data-act="invoice">Unduh invoice (demo)</button></div></div>
        <p class="sec-title">Rincian per perahu</p>
        <div class="card">${FLEET.map(f => `<div class="list-item"><div class="ic">⛵</div><div class="grow"><b>${f.name}</b><div class="muted small">${f.crew} • ${f.trips} trip</div></div><b>${rp(f.trips * FEE_PER_TRIP)}</b></div>`).join('')}</div>`;
    }
    const plan = PLANS.find(p => p.id === S.plan);
    return `
      <div class="card"><div class="row between"><div><h3>Kredit trip tersisa</h3><div class="big">${S.credits} trip</div></div>
        <span class="chip ok">Rp0 di muka</span></div>
        <p class="muted small" style="margin-top:6px">Satu biaya ${rp(FEE_PER_TRIP)}/trip sudah termasuk motor, energi, dan perawatan.</p></div>
      <p class="sec-title">Pilih paket</p>
      ${PLANS.map(p => `<button class="opt ${p.id === S.plan ? 'on' : ''}" data-plan="${p.id}"><span class="rad"></span><span class="grow"><b>${p.name}</b><div class="muted small">${p.desc}</div></span><span class="price">${rp(p.price)}</span></button>`).join('')}
      <p class="sec-title">Metode bayar</p>
      <div class="seg" id="methods"><button class="on" data-m="qris">QRIS</button><button data-m="transfer">Transfer</button><button data-m="cash">Tunai</button></div>
      <div class="card" id="pay-panel"></div>
      <button class="btn" data-act="pay">Bayar ${rp(plan.price)}</button>
      <p class="muted small" style="margin-top:8px;text-align:center">Demo: tidak ada transaksi nyata. QR hanya ilustrasi.</p>`;
  }
  function payPanel(m) {
    if (m === 'qris') return `<h2>Scan QRIS</h2>${fakeQR('SV' + S.plan + Date.now() % 1e5)}<p class="muted small" style="text-align:center">Kode berlaku 10 menit</p>`;
    if (m === 'transfer') return `<h2>Transfer bank</h2><p class="muted">Virtual account (contoh)</p><p class="big" style="letter-spacing:.05em">8077 0812 3456 78</p><p class="muted small">a.n. PT SeaVolt Energi Bahari (contoh)</p>`;
    return `<h2>Bayar tunai di kiosk</h2><p class="muted">Tunjukkan kode perahu ke petugas di Dock Station. Struk dikirim ke aplikasi.</p>`;
  }

  function vTrips() {
    const days = S.tripFilter === 'all' ? 9999 : +S.tripFilter;
    const cutoff = Date.now() - days * 864e5;
    const t = S.trips.filter(x => x.ts >= cutoff);
    const km = t.reduce((a, x) => a + x.km, 0), fee = t.reduce((a, x) => a + x.fee, 0);
    const petrol = t.length * PETROL_L_PER_TRIP * PETROL_PRICE;
    const buckets = 8, span = Math.min(days, 30) * 864e5 / buckets, now = Date.now();
    const data = Array.from({ length: buckets }, (_, i) =>
      S.trips.filter(x => now - x.ts >= (buckets - 1 - i) * span && now - x.ts < (buckets - i) * span).length);
    const max = Math.max(1, ...data);
    return `
      <div class="seg" id="filter">${[['7', '7H'], ['30', '30H'], ['90', '3B'], ['all', 'Semua']].map(([v, l]) => `<button data-f="${v}" class="${S.tripFilter === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="grid3" style="margin-bottom:12px">
        <div class="stat"><b>${t.length}</b><small>Trip</small></div>
        <div class="stat"><b>${km} km</b><small>Jarak</small></div>
        <div class="stat"><b>${rp(fee)}</b><small>Biaya</small></div>
      </div>
      <div class="card"><h2>Estimasi penghematan</h2>
        <div class="row between"><span class="muted">Jika memakai bensin (${t.length * PETROL_L_PER_TRIP} L)</span><b>${rp(petrol)}</b></div>
        <div class="row between"><span class="muted">Dengan SeaVolt</span><b>${rp(fee)}</b></div>
        <div class="row between" style="margin-top:6px"><b>Hemat</b><b style="color:#15803d">${rp(petrol - fee)}</b></div>
        <p class="muted small" style="margin-top:6px">Asumsi bensin ${rp(PETROL_PRICE)}/L (non-subsidi, ilustrasi).</p></div>
      <div class="card"><h2>Simulator penghematan</h2>
        <label class="muted small">Trip per bulan: <b id="sim-n-v">20</b></label><input type="range" id="sim-n" min="4" max="30" value="20" style="width:100%">
        <label class="muted small">Harga bensin /L: <b id="sim-p-v">${rp(PETROL_PRICE)}</b></label><input type="range" id="sim-p" min="8000" max="27000" step="500" value="${PETROL_PRICE}" style="width:100%">
        <div class="grid2" style="margin-top:8px"><div class="stat"><b id="sim-m">–</b><small>Hemat / bulan</small></div><div class="stat"><b id="sim-y">–</b><small>Hemat / tahun</small></div></div>
        <p class="muted small" style="margin-top:6px">Tanpa beli motor: kompetitor menjual motor surya Rp200–250 juta/unit. SeaVolt Rp0 di muka.</p></div>
      <div class="card"><h2>Trip per periode</h2><div class="chart">${data.map((d, i) => `<div><i class="${i % 2 ? 'a' : ''}" style="height:${d / max * 90}%"></i></div>`).join('')}</div></div>
      <div class="card">${t.length ? t.map(x => `<div class="list-item"><div class="ic">⛵</div><div class="grow"><b>${fmtDate(x.ts)}</b><div class="muted small">${x.km} km • ${x.method}</div></div><b>${rp(x.fee)}</b></div>`).join('') : '<p class="muted">Belum ada trip pada periode ini.</p>'}</div>`;
  }

  function vSafety() {
    const low = S.battery <= RETURN_ALERT;
    return `
      ${S.sos ? `<div class="alert"><span>🚨</span><div><b>Mode darurat aktif</b>Lokasi perahu dibagikan ke stasiun dan kontak keluarga (simulasi).</div></div>` : ''}
      ${low ? `<div class="alert warn"><span>⚠️</span><div><b>Baterai rendah (${Math.round(S.battery)}%)</b>Segera kembali ke dermaga.</div></div>` : `<div class="alert info"><span>✅</span><div><b>Semua sistem normal</b>Suhu baterai 31°C • arus 18 A • 51,2 V</div></div>`}
      <div class="card" style="text-align:center"><h2>Tombol darurat</h2>
        <button class="sos ${S.sos ? 'on' : ''}" data-act="sos">${S.sos ? 'AKTIF' : 'SOS'}</button>
        <p class="muted small">${S.sos ? 'Ketuk lagi untuk menonaktifkan' : 'Ketuk untuk membagikan lokasi perahu saat darurat'}</p></div>
      <div class="card"><div class="toggle"><span>Bagikan lokasi ke keluarga</span><input type="checkbox" class="sw" data-set="share" ${S.share ? 'checked' : ''}></div>
        <div class="toggle"><span>Peringatan baterai & suhu</span><input type="checkbox" class="sw" data-set="alertsOn" ${S.alertsOn ? 'checked' : ''}></div></div>
      <div class="card"><h2>Perlindungan otomatis</h2><p class="muted">BMS memutus daya sebelum baterai tidak aman: arus lebih, hubung singkat, suhu berlebih, dan pengosongan dalam.</p></div>`;
  }

  function vFleet() {
    const avg = Math.round(FLEET.reduce((a, f) => a + f.pct, 0) / FLEET.length);
    return `
      <div class="row between" style="margin:2px 4px 10px"><h2 style="font-size:20px">Armada Saya</h2><span class="chip">${FLEET.length} perahu • rata-rata ${avg}%</span></div>
      ${FLEET.map(f => `<div class="card row" style="padding:12px">
        <div class="ic" style="font-size:28px">⛵</div>
        <div class="grow"><div class="row between"><b>${f.name}</b><span class="muted small">${f.pct}%</span></div>
        <div class="bar" style="margin:6px 0"><i class="${batClass(f.pct)}" style="width:${f.pct}%"></i></div>
        <div class="muted small">${f.crew} • ${f.trips} trip bulan ini ${f.pct <= RETURN_ALERT ? '• <b style="color:#b91c1c">segera tukar</b>' : ''}</div></div></div>`).join('')}`;
  }

  function vImpact() {
    const owner = S.role === 'owner';
    const trips = owner ? FLEET.reduce((a, f) => a + f.trips, 0) : S.trips.length;
    return `
      <div class="impact-hero"><b>${owner ? 'Armada Anda' : 'Perahu Anda'} sejauh ini</b>
        <div class="grid2">
          <div class="stat"><b>${num(trips * PETROL_L_PER_TRIP)} L</b><small>Bensin tergantikan</small></div>
          <div class="stat"><b>${num(trips * CO2_KG_PER_TRIP, 1)} kg</b><small>CO₂ dihindari</small></div>
          <div class="stat"><b>${trips}</b><small>Trip listrik</small></div>
          <div class="stat"><b>${rp(trips * savingPerTrip())}</b><small>Estimasi hemat</small></div>
        </div></div>
      <div class="card"><h2>Per trip</h2>
        <div class="row between"><span class="muted">Bensin tergantikan</span><b>~${PETROL_L_PER_TRIP} L</b></div>
        <div class="row between"><span class="muted">CO₂ dihindari</span><b>~${CO2_KG_PER_TRIP} kg</b></div>
        <div class="row between"><span class="muted">Emisi saat berlayar</span><b>0 (tanpa asap & tumpahan oli)</b></div></div>
      <div class="card"><h2>Laporan ESG</h2><p class="muted">Unduh ringkasan bahan bakar tergantikan dan CO₂ dihindari per trip, per perahu, dan per armada.</p>
        <div style="margin-top:10px"><button class="btn blue" data-act="esg">Unduh laporan CSV</button></div></div>`;
  }

  function vHelp() {
    return `
      <div class="card"><h2>Laporkan masalah</h2>
        <select id="h-type"><option>Motor / propeler</option><option>Baterai / pengisian</option><option>Outlet 12 V / USB</option><option>Layar / IoT</option><option>Lainnya</option></select>
        <textarea id="h-note" rows="3" placeholder="Ceritakan singkat masalahnya…"></textarea>
        <button class="btn" data-act="help">Kirim & panggil teknisi</button></div>
      <p class="sec-title">Permintaan Anda</p>
      <div class="card">${S.help.length ? S.help.map(h => `<div class="list-item"><div class="ic">🛠️</div><div class="grow"><b>${h.type}</b><div class="muted small">${h.note || '—'}</div></div><span class="chip warn">Menunggu</span></div>`).join('') : '<p class="muted">Belum ada permintaan.</p>'}</div>`;
  }

  function rewardsCard() {
    const lv = [['Pelaut', 0], ['Nakhoda', 200], ['Laksamana', 500]];
    let i = 0; lv.forEach((x, k) => { if (S.points >= x[1]) i = k; });
    const next = lv[i + 1], pct = next ? (S.points - lv[i][1]) / (next[1] - lv[i][1]) * 100 : 100;
    return `<div class="card"><div class="row between"><h2>SeaVolt Rewards</h2><span class="chip warn">🏅 ${lv[i][0]}</span></div>
      <div class="big">${S.points} <span class="muted small">poin</span></div>
      <div class="bar" style="margin:8px 0"><i style="width:${pct}%;background:var(--amber)"></i></div>
      <p class="muted small">${next ? `${next[1] - S.points} poin lagi menuju ${next[0]}` : 'Level tertinggi!'} • +10 poin per trip, +5 per tukar baterai, +15 ajak teman.</p>
      <button class="btn sm ghost" data-act="refer" style="margin-top:8px">Ajak nelayan lain</button></div>`;
  }

  function vMore() {
    const l = (to, ic, t, d) => `<a href="#/${to}" class="card row" style="text-decoration:none;color:inherit"><span style="font-size:24px">${ic}</span><div class="grow"><b>${t}</b><div class="muted small">${d}</div></div><span>›</span></a>`;
    return `
      <div class="card"><h3>Mode akun (demo)</h3>
        <div class="seg" id="role" style="margin:6px 0 0"><button data-r="fisher" class="${S.role === 'fisher' ? 'on' : ''}">Nelayan</button><button data-r="owner" class="${S.role === 'owner' ? 'on' : ''}">Pemilik armada</button></div></div>
      ${rewardsCard()}
      ${l('safety', '🛡️', 'Keamanan & SOS', 'Peringatan dan bagikan lokasi')}
      ${S.role === 'owner' ? l('trips', '📊', 'Riwayat trip', 'Semua trip armada') : l('impact', '🌱', 'Dampak & ESG', 'Bensin tergantikan & CO₂ dihindari')}
      ${l('help', '🛠️', 'Bantuan & perawatan', 'Panggil teknisi di dermaga')}
      <div class="card"><h2>Tentang SeaVolt</h2><p class="muted">Layanan battery-swap untuk perahu nelayan: Rp0 di muka, ${rp(FEE_PER_TRIP)} per trip, tukar baterai &lt; 5 menit. Tim PIKAPI.</p>
        <div style="margin-top:10px"><button class="btn ghost" data-act="reset">Reset data demo</button></div></div>`;
  }

  // ---- Interactions ----------------------------------------------------------
  function download(name, text, type = 'text/csv') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function bind(name) {
    const view = $('#view');
    document.querySelectorAll('[data-go]').forEach(el => el.onclick = () => {
      const g = el.dataset.go;
      if (g === 'back') history.length > 1 ? history.back() : (location.hash = '#/home'); else location.hash = '#/' + g;
    });
    view.querySelectorAll('[data-pick]').forEach(el => el.onclick = () => { S.stationId = +el.dataset.pick; save(); render(); });
    view.querySelectorAll('[data-plan]').forEach(el => el.onclick = () => { S.plan = el.dataset.plan; save(); render(); });
    view.querySelectorAll('[data-f]').forEach(el => el.onclick = () => { S.tripFilter = el.dataset.f; save(); render(); });
    view.querySelectorAll('[data-r]').forEach(el => el.onclick = () => {
      S.role = el.dataset.r; save(); location.hash = '#/' + (S.role === 'owner' ? 'fleet' : 'home'); render();
    });
    view.querySelectorAll('[data-set]').forEach(el => el.onchange = () => { S[el.dataset.set] = el.checked; save(); });
    if (name === 'trips') {
      const sn = $('#sim-n'), sp = $('#sim-p');
      const calc = () => {
        const m = +sn.value * (PETROL_L_PER_TRIP * +sp.value - FEE_PER_TRIP);
        $('#sim-n-v').textContent = sn.value; $('#sim-p-v').textContent = rp(+sp.value);
        $('#sim-m').textContent = rp(Math.max(0, m)); $('#sim-y').textContent = rp(Math.max(0, m * 12));
      };
      sn.oninput = sp.oninput = calc; calc();
    }
    if (S.swapStep === 4 && !swapTimer) swapTimer = setTimeout(() => { swapTimer = null; if (S.swapStep === 4) act('swap-done'); }, 2600);
    if (name === 'pay' && S.role !== 'owner') {
      let m = 'qris'; const panel = $('#pay-panel'); panel.innerHTML = payPanel(m);
      view.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
        m = b.dataset.m; view.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('on', x === b)); panel.innerHTML = payPanel(m);
        view.dataset.method = m;
      });
      view.dataset.method = m;
    }
    view.querySelectorAll('[data-act]').forEach(el => el.onclick = () => act(el.dataset.act));
  }

  let swapTimer = null;
  function act(a, auto) {
    switch (a) {
      case 'start-trip': S.sailing = true; S.sailKm = 0; S.sailSec = 0; warned = false; toast('Selamat melaut! Telemetri aktif'); break;
      case 'end-trip': {
        S.sailing = false; S.speed = 0; S.amps = 0;
        const km = Math.max(1, Math.round(S.sailKm));
        S.trips.unshift({ ts: Date.now(), km, fee: FEE_PER_TRIP, method: S.credits > 0 ? 'Paket' : 'Tunai' });
        if (S.credits > 0) S.credits--;
        S.points += 10;
        toast(auto ? '🔋 BMS menghentikan motor (cadangan 20%). Trip tercatat, +10 poin' : `Trip selesai: ${km} km, +10 poin`);
        break;
      }
      case 'book': {
        const t = new Date(Date.now() + 20 * 6e4);
        S.booking = { stationId: S.stationId, time: t.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) };
        S.swapStep = 1; toast('Slot tukar baterai dipesan'); break;
      }
      case 'swap-next': S.swapStep = Math.min(4, S.swapStep + 1); break;
      case 'swap-done': S.battery = 100; S.booking = null; S.swapStep = 0; S.points += 5; warned = false; toast('✅ Tukar selesai • baterai 100% • +5 poin'); break;
      case 'refer': S.points += 15; toast('Tautan undangan disalin (demo) • +15 poin'); break;
      case 'cancel-booking': S.booking = null; S.swapStep = 0; clearTimeout(swapTimer); swapTimer = null; toast('Pemesanan dibatalkan'); break;
      case 'pay': {
        const plan = PLANS.find(p => p.id === S.plan);
        const method = { qris: 'QRIS', transfer: 'Transfer', cash: 'Tunai' }[$('#view').dataset.method || 'qris'];
        S.credits += plan.trips - 1;           // one trip is used by the swap happening now
        S.battery = 100;                       // fresh packs
        S.trips.unshift({ ts: Date.now(), km: 20, fee: plan.id === 'trip' ? plan.price : Math.round(plan.price / plan.trips), method });
        toast(`Pembayaran ${rp(plan.price)} via ${method} berhasil (demo) • baterai 100%`); break;
      }
      case 'invoice': {
        const rows = FLEET.map(f => `${f.name},${f.crew},${f.trips},${f.trips * FEE_PER_TRIP}`).join('\n');
        download('seavolt-invoice.csv', `Perahu,Kru,Trip,Biaya (Rp)\n${rows}\n`); break;
      }
      case 'esg': {
        const set = S.role === 'owner' ? FLEET.map(f => [f.name, f.trips]) : [['Perahu Anda', S.trips.length]];
        const rows = set.map(([n, t]) => `${n},${t},${t * PETROL_L_PER_TRIP},${(t * CO2_KG_PER_TRIP).toFixed(1)}`).join('\n');
        download('seavolt-esg.csv', `Perahu,Trip,Bensin tergantikan (L),CO2 dihindari (kg)\n${rows}\n`); break;
      }
      case 'sos': S.sos = !S.sos; toast(S.sos ? '🚨 Mode darurat aktif' : 'Mode darurat dimatikan'); break;
      case 'help': {
        S.help.unshift({ type: $('#h-type').value, note: $('#h-note').value.trim() });
        toast('Teknisi akan menemui Anda di dermaga'); break;
      }
      case 'reset': try { localStorage.removeItem('seavolt'); } catch {} S = defaults(); location.hash = '#/home'; toast('Data demo direset'); break;
    }
    save(); render();
  }

  window.addEventListener('hashchange', render);
  render();
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
