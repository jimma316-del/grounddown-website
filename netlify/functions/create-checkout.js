exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' } }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Payment not configured' }) }
  }

  let amount, name, email, jobSummary, origin
  try {
    ;({ amount, name, email, jobSummary, origin } = JSON.parse(event.body))
  } catch {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid request' }) }
  }

  if (!amount || amount < 100) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid deposit amount' }) }
  }

  const baseUrl = origin || 'https://grounddown.co.uk'

  const params = new URLSearchParams()
  params.set('mode', 'payment')
  params.set('line_items[0][price_data][currency]', 'gbp')
  params.set('line_items[0][price_data][unit_amount]', String(amount))
  params.set('line_items[0][price_data][product_data][name]', 'Booking Deposit – Ground Down Installation')
  params.set('line_items[0][price_data][product_data][description]', jobSummary || 'Ground screw installation deposit (10%). Refundable if not happy with available dates.')
  params.set('line_items[0][quantity]', '1')
  params.set('success_url', `${baseUrl}/booking-confirmed.html`)
  params.set('cancel_url', `${baseUrl}/calculator.html`)
  if (email) params.set('customer_email', email)
  if (name) params.set('payment_intent_data[metadata][customer_name]', name)
  params.set('payment_intent_data[metadata][job_summary]', (jobSummary || '').substring(0, 500))
  params.set('payment_intent_data[description]', `Booking deposit: ${name || 'Customer'}`)

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const session = await res.json()
    if (!res.ok) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: session.error?.message || 'Stripe error' }) }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ url: session.url }),
    }
  } catch (err) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Internal error' }) }
  }
}
