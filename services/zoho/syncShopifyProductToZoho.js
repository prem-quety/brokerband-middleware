// services/zoho/syncShopifyProductToZoho.js
import axios from 'axios'
import crypto from 'crypto'
import ZohoSyncLog from '../../models/ZohoSyncLog.js'
import { getZohoAccessToken } from './tokens.js'
import { log, extractError, slugify } from '../../utils/helpers.js'

const ORG_ID         = process.env.ZOHO_ORG_ID
const DEFAULT_TAX_ID = process.env.ZOHO_DEFAULT_TAX_ID

export const syncShopifyProductToZoho = async product => {
  log('info', 'ZohoSync →', product.id, product.title)

  const variant = product.variants[0]
  const sku     = variant?.sku || `sku-${product.id}`
  const hash    = crypto
    .createHash('sha256')
    .update(JSON.stringify({ title: product.title, price: variant.price }))
    .digest('hex')

  // skip if no change
  const existing = await ZohoSyncLog.findOne({ shopify_variant_id: variant.id })
  if (existing?.hash === hash) {
    log('info', 'ZohoSync skip no-change →', product.id)
    return
  }

  const token = await getZohoAccessToken()

  // sanitize name
  const name = slugify(product.title).substring(0, 255)

  // fetch cost
  let cost = 0
  try {
    const mfRes = await axios.get(
      `${process.env.SHOPIFY_STORE_URL}/admin/api/${process.env.SHOPIFY_API_VERSION}/products/${product.id}/metafields.json`,
      {
        headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN },
        params:  { namespace: 'custom', key: 'distributor_price' },
      }
    )
    const mf = mfRes.data.metafields?.[0]
    cost = mf ? parseFloat(mf.value) : 0
  } catch (err) {
    log('warn', 'ZohoSync cost fetch failed; using 0 →', extractError(err))
  }

  const payload = {
    name,
    sku,
    rate:        parseFloat(variant.price),
    tax_id:      DEFAULT_TAX_ID,
    is_taxable:  true,
    description: `$${cost.toFixed(2)}`,
  }

  log('info', 'ZohoSync payload →', payload)

  let success = false
  let lastErr = null

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await axios.post(
        'https://www.zohoapis.com/books/v3/items',
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          params: { organization_id: ORG_ID },
        }
      )
      log('info', `ZohoSync success (attempt ${attempt}) →`, res.data.item.item_id)

      await ZohoSyncLog.create({
        shopify_variant_id: variant.id,
        shopify_product_id: product.id,
        zoho_item_id:       res.data.item.item_id,
        sku,
        hash,
        synced_at:          new Date(),
        status:             'success',
      }).catch(e => log('warn', 'Failed to write success log →', extractError(e)))

      success = true
      break
    } catch (err) {
      lastErr = err
      const raw = extractError(err)
      const msg = typeof raw === 'string' ? raw : JSON.stringify(raw)
      log('warn', `ZohoSync error (attempt ${attempt}) →`, msg)

      if (attempt < 2) {
        // brief pause before retry
        await new Promise(r => setTimeout(r, 500))
        log('info', `ZohoSync retrying product ${product.id} (again)…`)
      }
    }
  }

  if (!success) {
    const raw = extractError(lastErr)
    const msg = typeof raw === 'string' ? raw : JSON.stringify(raw)

    ZohoSyncLog.create({
      shopify_variant_id: variant.id,
      shopify_product_id: product.id,
      sku,
      hash,
      synced_at: new Date(),
      status:    'failed',
      message:   msg,
    })
    .then(() => log('error', `ZohoSync gave up on ${product.id} →`, msg))
    .catch(e => log('warn', 'Failed to write failure log →', extractError(e)))
  }
}
