import 'dotenv/config'
import { submitPaymentProof } from '../../server/payments.js'
import { withApi, LIMITS } from '../../server/http.js'

// Buyer submits their bank-transfer proof (UTR + screenshot). Nothing is issued
// here — an admin has to approve the submission before a pass exists.
async function handler(req, res) {
  const result = await submitPaymentProof({
    registrationId: req.body?.registrationId,
    utrId: req.body?.utrId,
    proof: req.body?.proof,
    // Only the CODE crosses the wire — never an amount. The server re-resolves
    // the discount and computes what was owed.
    couponCode: req.body?.couponCode,
  })
  if (!result.ok) {
    return res.status(result.status).json({
      ok: false,
      error: result.error,
      soldOut: result.soldOut,
    })
  }
  return res.status(result.status).json({ ok: true, registration: result.registration })
}

// guardBody is OFF here, and only here. The shared 16 KB cap in withApi exists
// to stop a client wasting CPU on a junk payload, but this is the one endpoint
// whose legitimate body is a base64 screenshot — up to ~1.4 MB after the
// browser-side compression in pages/Register.jsx. Leaving the cap on rejected
// every real submission with a 413 before the handler could run, which is
// invisible to the buyer as anything but a failed upload. The binding ceiling
// is MAX_PROOF_BYTES inside submitPaymentProof, which validates the decoded
// image and is what actually protects the database column; the Express server
// mirrors this with its own 4 MB express.json limit.
export default withApi(handler, {
  methods: ['POST'],
  // LIMITS.coupon rather than LIMITS.register: this route now accepts a coupon
  // code and re-resolves it server-side, which makes it a second
  // coupon-existence oracle alongside /api/payment/coupon. Both are throttled
  // on the same budget so the tighter one cannot be sidestepped through here.
  // 20 per 15 minutes is still well clear of a real buyer, who submits once.
  limit: LIMITS.coupon,
  guardBody: false,
})
