const CRM_API_URL = 'https://ground-down-crm.vercel.app/api/leads/from-enquiry'
const CRM_API_KEY = 'gd-calc-k9x4m2p8'

document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('enquiry-form')
  if (!form) return

  const successMsg = document.createElement('div')
  successMsg.className = 'form-success-msg'
  successMsg.style.cssText = 'display:none;background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:1.5rem;text-align:center;'
  successMsg.innerHTML = '<p style="font-weight:700;color:#166534;margin:0 0 .5rem;">Enquiry sent — thank you!</p><p style="color:#15803d;font-size:.9rem;margin:0;">We\'ll be in touch within 1 working day.</p>'
  form.parentNode.insertBefore(successMsg, form.nextSibling)

  form.addEventListener('submit', async function (e) {
    e.preventDefault()

    const firstName = (document.getElementById('first-name').value || '').trim()
    const lastName  = (document.getElementById('last-name').value || '').trim()
    const name      = [firstName, lastName].filter(Boolean).join(' ')
    const email     = (document.getElementById('email').value || '').trim()
    const phone     = (document.getElementById('phone').value || '').trim()
    const postcode  = (document.getElementById('postcode').value || '').trim()
    const service   = (document.getElementById('service').value || '').trim()
    const width     = (document.getElementById('width').value || '').trim()
    const length    = (document.getElementById('length').value || '').trim()
    const message   = (document.getElementById('message').value || '').trim()

    const jobParts = []
    if (service) jobParts.push('Service: ' + service)
    if (width && length) jobParts.push('Dimensions: ' + width + 'm × ' + length + 'm')
    if (message) jobParts.push('Notes: ' + message)

    // Fire CRM lead creation (best-effort — don't block form submit on failure)
    try {
      await fetch(CRM_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': CRM_API_KEY },
        body: JSON.stringify({
          name,
          email:        email || null,
          phone:        phone || null,
          site_address: postcode || null,
          job_details:  jobParts.length ? jobParts.join('\n') : null,
        }),
      })
    } catch (_) {}

    // Submit to Formspree
    try {
      const data = new FormData(form)
      const resp = await fetch(form.action, {
        method: 'POST',
        body: data,
        headers: { 'Accept': 'application/json' },
      })
      if (resp.ok) {
        form.style.display = 'none'
        successMsg.style.display = 'block'
      } else {
        // Fallback: let native submit handle it
        form.removeEventListener('submit', arguments.callee)
        form.submit()
      }
    } catch (_) {
      form.removeEventListener('submit', arguments.callee)
      form.submit()
    }
  })
})
