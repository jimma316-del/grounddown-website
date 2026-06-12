const FORMSPREE_URL = 'https://formspree.io/f/xnjwdglr'

// Domestic pricing keyed by screw length, inc VAT only
const PRICING = {
  '1m': [
    { minQty: 1,  maxQty: 19,  supplyInc: 30, installedInc: 87 },
    { minQty: 20, maxQty: 29,  supplyInc: 29, installedInc: 81 },
    { minQty: 30, maxQty: 39,  supplyInc: 28, installedInc: 76 },
    { minQty: 40, maxQty: Infinity, supplyInc: 27, installedInc: 70 },
  ],
  '1.25m': [
    { minQty: 1,  maxQty: 19,  supplyInc: 33, installedInc: 90 },
    { minQty: 20, maxQty: 29,  supplyInc: 32, installedInc: 84 },
    { minQty: 30, maxQty: 39,  supplyInc: 31, installedInc: 78 },
    { minQty: 40, maxQty: Infinity, supplyInc: 30, installedInc: 72 },
  ],
  '1.5m': [
    { minQty: 1,  maxQty: 19,  supplyInc: 39, installedInc: 102 },
    { minQty: 20, maxQty: 29,  supplyInc: 37, installedInc: 96  },
    { minQty: 30, maxQty: 39,  supplyInc: 36, installedInc: 90  },
    { minQty: 40, maxQty: Infinity, supplyInc: 35, installedInc: 84 },
  ],
  '2m': [
    { minQty: 1,  maxQty: 19,  supplyInc: 44, installedInc: 120 },
    { minQty: 20, maxQty: 29,  supplyInc: 42, installedInc: 114 },
    { minQty: 30, maxQty: 39,  supplyInc: 41, installedInc: 108 },
    { minQty: 40, maxQty: Infinity, supplyInc: 40, installedInc: 102 },
  ],
}

// Mileage: chargeInc = inc VAT amount added to install total
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

function fmt(n) { return '£' + n.toFixed(0) }

function selectScrewLength(len) {
  selectedScrewLength = len
  document.querySelectorAll('[data-screw]').forEach(btn => btn.classList.toggle('active', btn.dataset.screw === len))
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
  const labels = ['1–19', '20–29', '30–39', '40+']
  const tbody = document.getElementById('pricing-tbody')
  if (!tbody) return
  tbody.innerHTML = tiers.map((t, i) => `
    <tr${i % 2 ? ' style="background:var(--grey-50);"' : ''}>
      <td style="padding:.5rem .75rem;border:1px solid var(--grey-100);font-weight:600;">${labels[i]}</td>
      <td style="padding:.5rem .75rem;text-align:right;border:1px solid var(--grey-100);">${fmt(t.supplyInc)} / screw</td>
      <td style="padding:.5rem .75rem;text-align:right;border:1px solid var(--grey-100);">${fmt(t.installedInc)} / screw</td>
    </tr>`).join('')
  const heading = document.getElementById('pricing-heading')
  if (heading) heading.textContent = `Pricing Reference (${selectedScrewLength} screws, domestic inc VAT)`
}

function clearResult() {
  document.getElementById('result-panel').innerHTML = `
    <div class="result-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      <p>Fill in the steps on the left and press <strong>Get My Price Estimate</strong> to see your quote.</p>
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

  const custName  = document.getElementById('cust-name').value.trim()
  const custEmail = document.getElementById('cust-email').value.trim()
  if (!custName) { errorEl.textContent = 'Please enter your name.'; errorEl.style.display = 'block'; return }
  if (!custEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(custEmail)) {
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

  const tier        = getPricing(sc.total)
  const supplyTotal = sc.total * tier.supplyInc
  const installBase = sc.total * tier.installedInc
  const baseLabel   = selectedBase ? BASE_CONFIGS[selectedBase].label : 'Custom spacing'

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

  const installTotal       = mileageTier.poa ? null : installBase + mileageTier.chargeInc
  const mileageChargeLabel = mileageTier.poa ? 'POA' : mileageTier.chargeInc === 0 ? 'FREE' : `${fmt(mileageTier.chargeInc)} inc VAT (${fmt(mileageTier.chargeEx)} ex VAT)`
  const installTotalLabel  = mileageTier.poa ? 'POA — contact us' : fmt(installTotal)

  const notices = []
  if (power  === 'no') notices.push('No power on site — a generator may be required.')
  if (access === 'no') notices.push('Limited site access — please mention this in your enquiry.')
  if (marked === 'no') notices.push('Screw locations not marked — a marking-out service can be arranged.')

  btn.textContent = 'Getting your quote…'
  try {
    const body = new FormData()
    body.append('_subject', `Calculator lead: ${custName} — ${width}m × ${depth}m (${selectedScrewLength} screws)`)
    body.append('Name', custName)
    body.append('Email', custEmail)
    body.append('Screw length', selectedScrewLength)
    body.append('Dimensions', `${width}m × ${depth}m`)
    body.append('Base type', baseLabel)
    body.append('Screws', `${sc.total} (${sc.rows} rows × ${sc.cols} wide)`)
    body.append('Supply only', fmt(supplyTotal) + ' inc VAT')
    body.append('Install (base)', fmt(installBase) + ' inc VAT')
    body.append('Mileage', `${mileageTier.label} — ${mileageChargeLabel}`)
    body.append('Install total', installTotalLabel)
    body.append('Site address', addressInput || 'Not provided')
    body.append('Est. miles', miles !== null ? miles + ' miles' : 'Not calculated')
    body.append('Power on site', power)
    body.append('Clear access', access)
    body.append('Locations marked', marked)
    body.append('_replyto', custEmail)
    fetch(FORMSPREE_URL, { method: 'POST', body, headers: { Accept: 'application/json' } })
  } catch {}

  btn.textContent = 'Get My Price Estimate'
  btn.disabled = false

  renderResult({ sc, tier, supplyTotal, installBase, installTotal, mileageTier,
    mileageChargeLabel, installTotalLabel, width, depth, miles, addressInput,
    baseLabel, notices, custName })
}

function renderResult({ sc, tier, supplyTotal, installBase, installTotal, mileageTier,
  mileageChargeLabel, installTotalLabel, width, depth, miles, addressInput,
  baseLabel, notices, custName }) {

  const tierLabel = sc.total <= 19 ? '1–19' : sc.total <= 29 ? '20–29' : sc.total <= 39 ? '30–39' : '40+'
  const tierColor = sc.total >= 40 ? 'tier-best' : sc.total >= 30 ? 'tier-good' : sc.total >= 20 ? 'tier-mid' : 'tier-base'

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
      <p class="price-box-label">Supply &amp; Install${mileageTier.chargeInc > 0 ? ' (inc travel)' : ''}</p>
      <p class="price-box-amount">${fmt(installTotal)}</p>
      ${mileageTier.chargeInc > 0
        ? `<div class="mileage-breakdown">
            <div class="mileage-line"><span>${sc.total} screws × ${fmt(tier.installedInc)}</span><span>${fmt(installBase)}</span></div>
            <div class="mileage-line mileage-surcharge"><span>Travel (${mileageTier.label})</span><span>+ ${fmt(mileageTier.chargeInc)}</span></div>
           </div>`
        : `<p class="price-box-note">inc VAT · ${fmt(tier.installedInc)} per screw · travel FREE</p>`}
    </div>`

  const noticesHtml = notices.map(n => `
    <div class="result-notice"><span class="notice-icon">⚠</span><span>${n}</span></div>`).join('')

  document.getElementById('result-panel').innerHTML = `
    <div class="result-card">
      <div class="result-header">
        <div>
          <p class="result-label">Hi ${custName.split(' ')[0]} — your estimate</p>
          <p class="result-big-num">${sc.total}</p>
          <p class="result-sub">${sc.rows} rows × ${sc.cols} wide · ${width}m × ${depth}m · ${baseLabel} · ${selectedScrewLength} screws</p>
        </div>
        <span class="tier-badge ${tierColor}">${tierLabel} screws · ${fmt(tier.installedInc)}/ea</span>
      </div>

      <div class="result-grid">
        <div class="price-box price-box--supply">
          <p class="price-box-label">Supply Only</p>
          <p class="price-box-amount">${fmt(supplyTotal)}</p>
          <p class="price-box-note">inc VAT · ${fmt(tier.supplyInc)} per screw</p>
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

      <p class="result-disclaimer">Estimate based on ${selectedScrewLength} screws at domestic rates inc VAT. Final quote confirmed within 1 working day.</p>
      <a href="contact.html" class="btn btn-primary btn-lg result-cta">Request a Formal Quote</a>
    </div>
  `

  document.getElementById('result-panel').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function resetCalc() {
  selectedBase = null
  selectedScrewLength = '1.25m'
  document.querySelectorAll('.base-btn').forEach(b => b.classList.remove('active'))
  document.querySelectorAll('[data-screw]').forEach(b => b.classList.toggle('active', b.dataset.screw === '1.25m'))
  document.getElementById('spacing-hint').style.display = 'none'
  ;['width', 'depth', 'spacing-width', 'spacing-depth', 'postcode', 'cust-name', 'cust-email'].forEach(id => {
    document.getElementById(id).value = ''
  })
  document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false)
  clearResult()
  document.getElementById('calc-error').style.display = 'none'
  updatePricingTable()
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-screw]').forEach(btn => {
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
