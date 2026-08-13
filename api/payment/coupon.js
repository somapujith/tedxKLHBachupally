import 'dotenv/config'
import { applyCoupon } from '../../server/coupons.js'
import { withApi, LIMITS } from '../../server/http.js'

// Checkout coupon preview. Public by necessity — the buyer has to see the
// discounted amount before they open their banking app and transfer money.
//
// This endpoint is an oracle: it answers "is this code real?" for any string,
// and codes are short and human-memorable. LIMITS.payment throttles it so the
// answer cannot be harvested by enumeration.
//
// What comes back is display data only. The amount actually written to the
// registration is recomputed inside submitPaymentProof from the code alone, so
// a tampered response here buys nothing.
async function handler(req, res) {
  const result = await applyCoupon(req.body?.code)
  if (!result.ok) {
    return res.status(result.status).json({ ok: false, error: result.error })
  }
  const { code, discount, passPrice, amount } = result.coupon
  return res.status(result.status).json({ ok: true, coupon: { code, discount, passPrice, amount } })
}

export default withApi(handler, {
  methods: ['POST'],
  // LIMITS.coupon, not LIMITS.payment: the coupon class carries a 15-minute
  // window instead of the shared 60-second one, so the guess budget matches the
  // Express deploy rather than being ~15x looser here.
  limit: LIMITS.coupon,
})
