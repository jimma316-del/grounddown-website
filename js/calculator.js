const PRICING = [
  { minQty: 1,  maxQty: 19,  supplyInc: 39, installedInc: 90 },
  { minQty: 20, maxQty: 29,  supplyInc: 35, installedInc: 84 },
  { minQty: 30, maxQty: 39,  supplyInc: 35, installedInc: 78 },
  { minQty: 40, maxQty: Infinity, supplyInc: 35, installedInc: 72 },
]

const BASE_CONFIGS = {
  sips: { label: 'SIPs Base',   widthSpacing: 1.22, depthSpacing: 1.5  },
  '4x2': { label: '4"×2" Base', widthSpacing: 1.2,  depthSpacing: 1.2  },
  '5x2': { label: '5"×2" Base', widthSpacing: 1.5,  depthSpacing: 1.5  },
  '6x2': { label: '6"×2" Base', widthSpacing: 1.8,  depthSpacing: 1.8  },
}

const INSET = 0.1
// Ground Down base: Lyne Lane, Lyne, Surrey KT16 0AN
const GD_LAT = 51.392
const GD_LNG = -0.530

let selectedBase = null

function calcScrews(width, depth, swid, sdep) {
  if (swid <= 0 || sdep <= 0 || width <= 0.2 || depth <= 0.2) return null
  const ew = width - 2 * INSET
  const ed = depth - 2 * INSET
  const cols = Math.ceil(ew / swid) + 1
  const rows = Math.ceil(ed / sdep) + 1
  return { cols, rows, total: cols * rows, widthSpan: ew / (cols - 1), depthSpan: ed / (rows - 1) }
}

function getPricing(qty) {
  return PRICING.find(t => qty >= t.minQty && qty <= t.maxQty) || PRICING[PRICING.length - 1]
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

function selectBase(key) {
  selectedBase = key
  const cfg = BASE_CONFIGS[key]
  document.getElementById('spacing-width').value = cfg.widthSpacing
  document.getElementById('spacing-depth').value = cfg.depthSpacing

  document.querySelectorAll('.base-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.base === key)
  })

  const hint = document.getElementById('spacing-hint')
  hint.textContent = `Auto-filled: max ${cfg.widthSpacing}m wide · ${cfg.depthSpacing}m deep — edit below if needed`
  hint.style.display = 'block'
}

async function calculate() {
  const width = parseFloat(document.getElementById('width').value)
  const depth = parseFloat(document.getElementById('depth').value)
  const swid  = parseFloat(document.getElementById('spacing-width').value)
  const sdep  = parseFloat(document.getElementById('spacing-depth').value)

  const errorEl = document.getElementById('calc-error')
  if (!width || !depth || !swid || !sdep || width <= 0 || depth <= 0 || swid <= 0 || sdep <= 0) {
    errorEl.textContent = 'Please enter valid dimensions and spacing values.'
    errorEl.style.display = 'block'
    return
  }
  errorEl.style.display = 'none'

  const sc = calcScrews(width, depth, swid, sdep)
  if (!sc || sc.total < 1) {
    errorEl.textContent = 'Could not calculate — check your dimensions.'
    errorEl.style.display = 'block'
    return
  }

  const tier = getPricing(sc.total)
  const supplyTotal = sc.total * tier.supplyInc
  const installedTotal = sc.total * tier.installedInc

  const power  = document.querySelector('input[name="power"]:checked')?.value || null
  const access = document.querySelector('input[name="access"]:checked')?.value || null
  const marked = document.querySelector('input[name="marked"]:checked')?.value || null
  const addressInput = document.getElementById('postcode').value.trim()

  // Show result panel immediately, mileage loads asynchronously
  renderResult({ sc, tier, supplyTotal, installedTotal, width, depth, swid, sdep, power, access, marked, miles: null, addressInput })

  if (addressInput) {
    document.getElementById('mileage-row').innerHTML = '<span class="mileage-loading">Calculating distance…</span>'
    const coords = await geocodeAddress(addressInput)
    if (coords) {
      const straightLine = haversineMiles(GD_LAT, GD_LNG, coords.lat, coords.lng)
      // Road distance is roughly 1.25× straight-line for UK
      const roadEst = Math.round(straightLine * 1.25)
      renderMileage(roadEst)
    } else {
      document.getElementById('mileage-row').innerHTML = '<span class="mileage-unknown">Distance could not be calculated — please mention your location when requesting a quote</span>'
    }
  }
}

function renderMileage(miles) {
  const el = document.getElementById('mileage-row')
  if (!el) return
  const note = miles > 30 ? ' — a travel supplement may apply, our team will confirm' : ''
  el.innerHTML = `
    <svg class="res-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
    <span>Approx <strong>${miles} miles</strong> from our Lyne, Surrey base${note}</span>
  `
}

function renderResult({ sc, tier, supplyTotal, installedTotal, width, depth, swid, sdep, power, access, marked, addressInput }) {
  const baseLabel = selectedBase ? BASE_CONFIGS[selectedBase].label : 'Custom spacing'
  const tierLabel = sc.total <= 19 ? '1–19' : sc.total <= 29 ? '20–29' : sc.total <= 39 ? '30–39' : '40+'
  const tierColor = sc.total >= 40 ? 'tier-best' : sc.total >= 30 ? 'tier-good' : sc.total >= 20 ? 'tier-mid' : 'tier-base'

  const notices = []
  if (power === 'no')   notices.push({ icon: '⚡', text: 'No power on site — a generator may be required. Mention this in your enquiry.' })
  if (access === 'no')  notices.push({ icon: '🚧', text: 'Limited access — our team will assess and confirm if this affects the quote.' })
  if (marked === 'no')  notices.push({ icon: '📍', text: 'Screw locations not marked — we offer a marking-out service, mention this in your enquiry.' })

  const noticesHtml = notices.map(n => `
    <div class="result-notice">
      <span class="notice-icon">${n.icon}</span>
      <span>${n.text}</span>
    </div>
  `).join('')

  const mileageHtml = addressInput ? `
    <div class="result-meta-row" id="mileage-row">
      <span class="mileage-loading">Calculating distance…</span>
    </div>
  ` : ''

  const panel = document.getElementById('result-panel')
  panel.innerHTML = `
    <div class="result-card">
      <div class="result-header">
        <div>
          <p class="result-label">Estimated screws</p>
          <p class="result-big-num">${sc.total}</p>
          <p class="result-sub">${sc.rows} rows × ${sc.cols} wide · ${width}m × ${depth}m · ${baseLabel}</p>
        </div>
        <span class="tier-badge ${tierColor}">${tierLabel} screws · ${fmt(tier.installedInc)}/ea inc VAT</span>
      </div>

      <div class="result-grid">
        <div class="price-box price-box--supply">
          <p class="price-box-label">Supply Only</p>
          <p class="price-box-amount">${fmt(supplyTotal)}</p>
          <p class="price-box-note">inc VAT · ${fmt(tier.supplyInc)} per screw</p>
        </div>
        <div class="price-box price-box--install">
          <p class="price-box-label">Supply &amp; Install</p>
          <p class="price-box-amount">${fmt(installedTotal)}</p>
          <p class="price-box-note">inc VAT · ${fmt(tier.installedInc)} per screw</p>
        </div>
      </div>

      <div class="result-meta">
        <div class="result-meta-row">
          <svg class="res-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          <span>Width span: <strong>${sc.widthSpan.toFixed(3)}m</strong> · Depth span: <strong>${sc.depthSpan.toFixed(3)}m</strong></span>
        </div>
        ${mileageHtml}
      </div>

      ${notices.length ? `<div class="result-notices">${noticesHtml}</div>` : ''}

      <p class="result-disclaimer">Price estimate only — based on standard 1.25m screws on domestic/residential rates. Final quote confirmed on enquiry.</p>

      <a href="contact.html?ref=calculator" class="btn btn-primary btn-lg result-cta">Get a Formal Quote</a>
    </div>
  `

  panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
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

  document.getElementById('calculate-btn').addEventListener('click', calculate)

  document.getElementById('reset-btn').addEventListener('click', () => {
    selectedBase = null
    document.querySelectorAll('.base-btn').forEach(b => b.classList.remove('active'))
    document.getElementById('spacing-hint').style.display = 'none'
    ;['width', 'depth', 'spacing-width', 'spacing-depth', 'postcode'].forEach(id => {
      document.getElementById(id).value = ''
    })
    document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false)
    document.getElementById('result-panel').innerHTML = ''
    document.getElementById('calc-error').style.display = 'none'
  })
})
