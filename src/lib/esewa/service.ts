/**
 * eSewa ePay v2 service — server-side ONLY (uses the merchant secret key).
 * Reference: https://developer.esewa.com.np/pages/Epay
 */

import { createHmac, timingSafeEqual } from 'crypto'
import { ESEWA_URLS, ESEWA_VERIFY_URLS } from '@/lib/constants'

type EsewaEnvironment = keyof typeof ESEWA_URLS

// Public sandbox credentials from the eSewa docs. Production requires real ones.
const SANDBOX_PRODUCT_CODE = 'EPAYTEST'
const SANDBOX_SECRET_KEY = '8gBm/:&EnhH.1/q'

function getConfig() {
  const environment: EsewaEnvironment =
    process.env.ESEWA_ENVIRONMENT === 'production' ? 'production' : 'sandbox'
  const productCode = process.env.ESEWA_PRODUCT_CODE || SANDBOX_PRODUCT_CODE
  const secretKey = process.env.ESEWA_SECRET_KEY || (environment === 'sandbox' ? SANDBOX_SECRET_KEY : '')

  if (!secretKey) {
    throw new Error('ESEWA_SECRET_KEY is required when ESEWA_ENVIRONMENT=production')
  }

  return { environment, productCode, secretKey }
}

/** eSewa signs/echoes amounts as plain strings, e.g. "100" or "100.5". */
export function formatEsewaAmount(amount: number): string {
  return String(Number(amount.toFixed(2)))
}

function sign(message: string): string {
  return createHmac('sha256', getConfig().secretKey).update(message).digest('base64')
}

export interface EsewaFormPayload {
  formUrl: string
  fields: Record<string, string>
}

export interface EsewaCallbackData {
  transaction_code: string
  status: string
  total_amount: string
  transaction_uuid: string
  product_code: string
  signed_field_names: string
  signature: string
}

/**
 * Build the signed field set the browser POSTs to eSewa.
 * Signature covers: total_amount,transaction_uuid,product_code (in that order).
 */
function generatePaymentForm(params: {
  /** Item price(s) */
  amount: number
  /** StudentMarket platform fee (sent as eSewa's service charge) */
  serviceCharge?: number
  deliveryCharge?: number
  transactionUuid: string
  successUrl: string
  failureUrl: string
}): EsewaFormPayload {
  const { environment, productCode } = getConfig()
  const deliveryCharge = params.deliveryCharge ?? 0
  const serviceCharge = params.serviceCharge ?? 0
  const totalAmount = params.amount + serviceCharge + deliveryCharge

  const total = formatEsewaAmount(totalAmount)
  const signedFieldNames = 'total_amount,transaction_uuid,product_code'
  const signature = sign(
    `total_amount=${total},transaction_uuid=${params.transactionUuid},product_code=${productCode}`
  )

  return {
    formUrl: ESEWA_URLS[environment],
    fields: {
      amount: formatEsewaAmount(params.amount),
      tax_amount: '0',
      total_amount: total,
      transaction_uuid: params.transactionUuid,
      product_code: productCode,
      product_service_charge: formatEsewaAmount(serviceCharge),
      product_delivery_charge: formatEsewaAmount(deliveryCharge),
      success_url: params.successUrl,
      failure_url: params.failureUrl,
      signed_field_names: signedFieldNames,
      signature,
    },
  }
}

/** Decode the base64 `data` query param eSewa appends to success_url. */
function decodeCallbackData(encoded: string): EsewaCallbackData | null {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'))
    if (
      typeof parsed?.transaction_uuid !== 'string' ||
      typeof parsed?.signed_field_names !== 'string' ||
      typeof parsed?.signature !== 'string'
    ) {
      return null
    }
    return parsed as EsewaCallbackData
  } catch {
    return null
  }
}

/** Verify the HMAC signature eSewa attached to the callback payload. */
function verifySignature(data: EsewaCallbackData): boolean {
  const fields = data.signed_field_names.split(',')
  const record = data as unknown as Record<string, string | undefined>
  if (fields.some((f) => record[f] === undefined)) return false

  const message = fields.map((f) => `${f}=${record[f]}`).join(',')
  const expected = Buffer.from(sign(message))
  const actual = Buffer.from(data.signature)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export interface EsewaStatusResult {
  status: string
  refId?: string
}

/**
 * Ask eSewa directly for the transaction status.
 * Never trust the browser redirect alone — this is the source of truth.
 */
async function checkTransactionStatus(params: {
  transactionUuid: string
  totalAmount: number
}): Promise<EsewaStatusResult> {
  const { environment, productCode } = getConfig()
  const query = new URLSearchParams({
    product_code: productCode,
    total_amount: formatEsewaAmount(params.totalAmount),
    transaction_uuid: params.transactionUuid,
  })

  const res = await fetch(`${ESEWA_VERIFY_URLS[environment]}?${query}`, {
    method: 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    throw new Error(`eSewa status API returned ${res.status}`)
  }

  const json = await res.json()
  return { status: String(json.status), refId: json.ref_id ?? undefined }
}

export const ESewaService = {
  generatePaymentForm,
  decodeCallbackData,
  verifySignature,
  checkTransactionStatus,
}
