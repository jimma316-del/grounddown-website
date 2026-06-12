const FORMSPREE_URL = 'https://formspree.io/f/xnjwdglr'

// Trade pricing keyed by screw length, inc and ex VAT
const PRICING = {
  '1m': [
    { minQty: 1,  maxQty: 19,  supplyInc: 32, supplyEx: 26.7, installedInc: 76, installedEx: 63.3 },
    { minQty: 20, maxQty: Infinity, supplyInc: 30, supplyEx: 25.0, installedInc: 70, installedEx: 58.3 },
  ],
  '1.25m': [
    { minQty: 1,  maxQty: 19,  supplyInc: 35, supplyEx: 29.2, installedInc: 78, installedEx: 65.0 },
    { minQty: 20, maxQty: Infinity, supplyInc: 33, supplyEx: 27.5, installedInc: 72, installedEx: 60.0 },
  ],
  '1.5m': [
    { minQty: 1,  maxQty: 19,  supplyInc: 40, supplyEx: 33.3, installedInc: 90, installedEx: 75.0 },
    { minQty: 20, maxQty: Infinity, supplyInc: 37, supplyEx: 30.8, installedInc: 84, installedEx: 70.0 },
  ],
  '2m': [
    { minQty: 1,  maxQty: 19,  supplyInc: 45, supplyEx: 37.5, installedInc: 108, installedEx: 90.0 },
    { minQty: 20, maxQty: Infinity, supplyInc: 42, supplyEx: 35.0, installedInc: 102, installedEx: 85.0 },
  ],
}

const MILEAGE = [
  { maxMiles: 35,       label: 'Within 35 miles', chargeEx: 0,   chargeInc: 0,   poa: false },
  { maxMiles: 55,       label: '35–55 miles',      chargeEx: 75,  chargeInc: 90,  poa: false },
  { maxMiles: 75,       label: '55–75 miles',      chargeEx: 150, chargeInc: 180, poa: false },
  { maxMiles: Infinity, label: '75+ miles',         chargeEx: 0,   chargeInc: 0,   poa: true  },
]

const BASE_CONFIGS = {
  sips:  { label: 'SIPs Base',   widthSpacing: 1.22, depthSpacing: 1.5 },
  '4x2': { label: '4"×2" Base', widthSpacing: 1.2,  depthSpacing: 1.2 },
  '5x2': { label: '5"×2" Base', widthSpacing: 1.5,  depthSpacing: 1.5 },
  '6x2': { label: '6"×2" Base', widthSpacing: 1.8,  depthSpacing: 1.8 },
}

const INSET  = 0.1
const GD_LAT = 51.392
const GD_LNG = -0.530

let selectedScrewLength = '1.25m'
let selectedBase = null

function calcScrews(width, depth, swid, sdep) {
  if (swid <= 0 || sdep <= 0 || width <= 0.2 || depth <= 0.2) return null
  const cols = Math.ceil((width - 2 * INSET) / swid) + 1
  const rows = Math.ceil((depth - 2 * INSET) / sdep) + 1
  const ew = width - 2 * INSET
  const ed = depth - 2 * INSET
  return { cols, rows, total: cols * rows, widthSpan: ew / (cols - 1), depthSpan: ed / (rows - 1) }
}

function getPricing(qty) {
  const tiers = PRICING[selectedScrewLength]
  return tiers.find(t => qty >= t.minQty && qty <= t.maxQty) || tiers[tiers.length - 1]
}

function getMileageTier(miles) {
  return MILEAGE.find(t => miles <= t.maxMiles) || MILEAGE[MILEAGE.length - 1]
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function geocodeAddress(address) {
  try {
    const q = encodeURIComponent(address.trim() + ', UK')
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=gb`,
      { headers: { 'User-Agent': 'GroundDownPriceCalculator/1.0 (grounddown.co.uk)' } }
    )
    const data = await resp.json()
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {}
  return null
}

function fmtInc(n) { return '£' + n.toFixed(0) }
function fmtEx(n)  { return '£' + (+n.toFixed(2)) }

function selectScrewLength(len) {
  selectedScrewLength = len
  document.querySelectorAll('.screw-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.screw === len))
  clearResult()
  updatePricingTable()
}

function selectBase(key) {
  selectedBase = key
  const cfg = BASE_CONFIGS[key]
  document.getElementById('spacing-width').value = cfg.widthSpacing
  document.getElementById('spacing-depth').value = cfg.depthSpacing
  document.querySelectorAll('.base-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.base === key))
  const hint = document.getElementById('spacing-hint')
  hint.textContent = `Auto-filled: max ${cfg.widthSpacing}m wide · ${cfg.depthSpacing}m deep — edit below if needed`
  hint.style.display = 'block'
}

function updatePricingTable() {
  const tiers = PRICING[selectedScrewLength]
  const labels = ['1–19', '20+']
  const tbody = document.getElementById('pricing-tbody')
  if (!tbody) return
  tbody.innerHTML = tiers.map((t, i) => `
    <tr${i % 2 ? ' style="background:var(--grey-50);"' : ''}>
      <td style="padding:.5rem .75rem;border:1px solid var(--grey-100);font-weight:600;">${labels[i] || '20+'}</td>
      <td style="padding:.5rem .75rem;text-align:right;border:1px solid var(--grey-100);">£${fmtEx(t.supplyEx)} / ${fmtInc(t.supplyInc)}</td>
      <td style="padding:.5rem .75rem;text-align:right;border:1px solid var(--grey-100);">£${fmtEx(t.installedEx)} / ${fmtInc(t.installedInc)}</td>
    </tr>`).join('')
  const heading = document.getElementById('pricing-heading')
  if (heading) heading.textContent = `Pricing Reference (${selectedScrewLength} screws, trade — ex VAT / inc VAT)`
}

function clearResult() {
  document.getElementById('result-panel').innerHTML = `
    <div class="result-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      <p>Fill in the steps on the left and press <strong>Get My Trade Estimate</strong> to see your quote.</p>
    </div>`
}

async function handleSubmit() {
  const btn = document.getElementById('calculate-btn')
  const errorEl = document.getElementById('calc-error')
  errorEl.style.display = 'none'

  const width = parseFloat(document.getElementById('width').value)
  const depth = parseFloat(document.getElementById('depth').value)
  const swid  = parseFloat(document.getElementById('spacing-width').value)
  const sdep  = parseFloat(document.getElementById('spacing-depth').value)

  if (!width || !depth || !swid || !sdep || width <= 0 || depth <= 0 || swid <= 0 || sdep <= 0) {
    errorEl.textContent = 'Please enter valid dimensions and spacing values.'
    errorEl.style.display = 'block'
    return
  }

  const sc = calcScrews(width, depth, swid, sdep)
  if (!sc || sc.total < 1) {
    errorEl.textContent = 'Could not calculate — check your dimensions.'
    errorEl.style.display = 'block'
    return
  }

  const bizName    = document.getElementById('biz-name').value.trim()
  const bizEmail   = document.getElementById('biz-email').value.trim()
  const bizAddress = document.getElementById('biz-address').value.trim()

  if (!bizName)  { errorEl.textContent = 'Please enter your business name.'; errorEl.style.display = 'block'; return }
  if (!bizEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bizEmail)) {
    errorEl.textContent = 'Please enter a valid email address.'
    errorEl.style.display = 'block'
    return
  }

  btn.textContent = 'Calculating…'
  btn.disabled = true

  const power   = document.querySelector('input[name="power"]:checked')?.value  || 'Not specified'
  const access  = document.querySelector('input[name="access"]:checked')?.value || 'Not specified'
  const marked  = document.querySelector('input[name="marked"]:checked')?.value || 'Not specified'
  const addressInput = document.getElementById('postcode').value.trim()

  const tier           = getPricing(sc.total)
  const supplyTotalInc = sc.total * tier.supplyInc
  const supplyTotalEx  = sc.total * tier.supplyEx
  const installBaseInc = sc.total * tier.installedInc
  const installBaseEx  = sc.total * tier.installedEx
  const baseLabel      = selectedBase ? BASE_CONFIGS[selectedBase].label : 'Custom spacing'

  let miles = null
  let mileageTier = MILEAGE[0]

  if (addressInput) {
    btn.textContent = 'Calculating distance…'
    const coords = await geocodeAddress(addressInput)
    if (coords) {
      miles = Math.round(haversineMiles(GD_LAT, GD_LNG, coords.lat, coords.lng) * 1.25)
      mileageTier = getMileageTier(miles)
    }
  }

  const installTotalInc    = mileageTier.poa ? null : installBaseInc + mileageTier.chargeInc
  const installTotalEx     = mileageTier.poa ? null : installBaseEx  + mileageTier.chargeEx
  const mileageChargeLabel = mileageTier.poa ? 'POA' : mileageTier.chargeEx === 0 ? 'FREE' : `£${mileageTier.chargeEx} ex VAT`

  const notices = []
  if (power  === 'no') notices.push('No power on site — a generator may be required.')
  if (access === 'no') notices.push('Limited site access — please mention this in your enquiry.')
  if (marked === 'no') notices.push('Screw locations not marked — a marking-out service can be arranged.')

  btn.textContent = 'Getting your quote…'
  try {
    const body = new FormData()
    body.append('_subject', `TRADE calculator lead: ${bizName} — ${width}m × ${depth}m (${selectedScrewLength} screws)`)
    body.append('Business name', bizName)
    body.append('Business email', bizEmail)
    body.append('Business address', bizAddress || 'Not provided')
    body.append('Screw length', selectedScrewLength)
    body.append('Dimensions', `${width}m × ${depth}m`)
    body.append('Base type', baseLabel)
    body.append('Screws', `${sc.total} (${sc.rows} rows × ${sc.cols} wide)`)
    body.append('Supply only', `${fmtInc(supplyTotalInc)} inc / £${fmtEx(supplyTotalEx)} ex VAT`)
    body.append('Install (base)', `${fmtInc(installBaseInc)} inc / £${fmtEx(installBaseEx)} ex VAT`)
    body.append('Mileage', `${mileageTier.label} — ${mileageChargeLabel}`)
    body.append('Install total', mileageTier.poa ? 'POA' : `${fmtInc(installTotalInc)} inc / £${fmtEx(installTotalEx)} ex VAT`)
    body.append('Site address', addressInput || 'Not provided')
    body.append('Est. miles', miles !== null ? miles + ' miles' : 'Not calculated')
    body.append('Power on site', power)
    body.append('Clear access', access)
    body.append('Locations marked', marked)
    body.append('_replyto', bizEmail)
    fetch(FORMSPREE_URL, { method: 'POST', body, headers: { Accept: 'application/json' } })
  } catch {}

  btn.textContent = 'Get My Trade Estimate'
  btn.disabled = false

  renderResult({ sc, tier, supplyTotalInc, supplyTotalEx, installBaseInc, installBaseEx,
    installTotalInc, installTotalEx, mileageTier, mileageChargeLabel,
    width, depth, miles, addressInput, baseLabel, notices, bizName })
}

function renderResult({ sc, tier, supplyTotalInc, supplyTotalEx, installBaseInc, installBaseEx,
  installTotalInc, installTotalEx, mileageTier, mileageChargeLabel,
  width, depth, miles, addressInput, baseLabel, notices, bizName }) {

  const tierLabel = sc.total <= 19 ? '1–19' : '20+'
  const tierColor = sc.total >= 20 ? 'tier-best' : 'tier-base'

  const mileageRow = addressInput ? `
    <div class="result-meta-row">
      <svg class="res-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      <span>${miles !== null ? `Approx <strong>${miles} miles</strong> from our Lyne, Surrey base` : 'Distance could not be calculated'} &mdash; <strong>${mileageTier.label}</strong></span>
    </div>` : ''

  const installBoxHtml = mileageTier.poa ? `
    <div class="price-box price-box--install poa-box">
      <p class="price-box-label">Supply &amp; Install</p>
      <p class="price-box-amount poa-amount">POA</p>
      <p class="price-box-note">75+ miles — contact us for a quote including travel</p>
    </div>` : `
    <div class="price-box price-box--install">
      <p class="price-box-label">Supply &amp; Install${mileageTier.chargeEx > 0 ? ' (inc travel)' : ''}</p>
      <p class="price-box-amount">${fmtInc(installTotalInc)}</p>
      <p class="price-box-note-ex">£${fmtEx(installTotalEx)} ex VAT</p>
      ${mileageTier.chargeEx > 0
        ? `<div class="mileage-breakdown">
            <div class="mileage-line"><span>${sc.total} × £${fmtEx(tier.installedEx)} ex VAT</span><span>£${fmtEx(installBaseEx)}</span></div>
            <div class="mileage-line mileage-surcharge"><span>Travel (${mileageTier.label})</span><span>+ £${mileageTier.chargeEx} ex VAT</span></div>
           </div>`
        : `<p class="price-box-note">£${fmtEx(tier.installedEx)} ex VAT per screw · travel FREE</p>`}
    </div>`

  const noticesHtml = notices.map(n => `
    <div class="result-notice"><span class="notice-icon">⚠</span><span>${n}</span></div>`).join('')

  document.getElementById('result-panel').innerHTML = `
    <div class="result-card">
      <div class="result-header">
        <div>
          <p class="result-label">${bizName} — trade estimate</p>
          <p class="result-big-num">${sc.total}</p>
          <p class="result-sub">${sc.rows} rows × ${sc.cols} wide · ${width}m × ${depth}m · ${baseLabel} · ${selectedScrewLength} screws</p>
        </div>
        <span class="tier-badge ${tierColor}">${tierLabel} screws · £${fmtEx(tier.installedEx)} ex VAT</span>
      </div>

      <div class="result-grid">
        <div class="price-box price-box--supply">
          <p class="price-box-label">Supply Only</p>
          <p class="price-box-amount">${fmtInc(supplyTotalInc)}</p>
          <p class="price-box-note-ex">£${fmtEx(supplyTotalEx)} ex VAT</p>
          <p class="price-box-note">£${fmtEx(tier.supplyEx)} ex VAT per screw</p>
        </div>
        ${installBoxHtml}
      </div>

      <div class="result-meta">
        <div class="result-meta-row">
          <svg class="res-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          <span>Width span: <strong>${sc.widthSpan.toFixed(3)}m</strong> · Depth span: <strong>${sc.depthSpan.toFixed(3)}m</strong></span>
        </div>
        ${mileageRow}
      </div>

      ${notices.length ? `<div class="result-notices">${noticesHtml}</div>` : ''}

      <p class="result-disclaimer">Trade estimate — ${selectedScrewLength} screws. Formal quote confirmed within 1 working day. Trade accounts available on request.</p>
      <a href="contact.html" class="btn btn-primary btn-lg result-cta">Request a Formal Quote</a>
    </div>
  `

  document.getElementById('result-panel').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function resetCalc() {
  selectedBase = null
  selectedScrewLength = '1.25m'
  document.querySelectorAll('.base-btn').forEach(b => b.classList.remove('active'))
  document.querySelectorAll('.screw-btn').forEach(b => b.classList.toggle('active', b.dataset.screw === '1.25m'))
  document.getElementById('spacing-hint').style.display = 'none'
  ;['width', 'depth', 'spacing-width', 'spacing-depth', 'postcode', 'biz-name', 'biz-email', 'biz-address'].forEach(id => {
    document.getElementById(id).value = ''
  })
  document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false)
  clearResult()
  document.getElementById('calc-error').style.display = 'none'
  updatePricingTable()
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.screw-btn').forEach(btn => {
    btn.addEventListener('click', () => selectScrewLength(btn.dataset.screw))
  })
  document.querySelectorAll('.base-btn').forEach(btn => {
    btn.addEventListener('click', () => selectBase(btn.dataset.base))
  })
  document.getElementById('spacing-width').addEventListener('input', () => {
    selectedBase = null
    document.querySelectorAll('.base-btn').forEach(b => b.classList.remove('active'))
    document.getElementById('spacing-hint').style.display = 'none'
  })
  document.getElementById('spacing-depth').addEventListener('input', () => {
    selectedBase = null
    document.querySelectorAll('.base-btn').forEach(b => b.classList.remove('active'))
    document.getElementById('spacing-hint').style.display = 'none'
  })
  document.getElementById('calculate-btn').addEventListener('click', handleSubmit)
  document.getElementById('reset-btn').addEventListener('click', resetCalc)
  updatePricingTable()
})
