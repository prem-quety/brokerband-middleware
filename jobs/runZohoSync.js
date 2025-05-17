import { syncShopifyProductToZoho } from '../services/zoho/syncShopifyProductToZoho.js'
import { getAllShopifyProducts }         from '../services/shopify/shopify.js'

export const runZohoProductSync = async () => {
  console.log('[ZohoSync Job] starting runZohoProductSync')
  const products = await getAllShopifyProducts()
  console.log('[ZohoSync Job] fetched products →', products.length)

  for (const product of products) {
    console.log(`[ZohoSync Job] syncing product → ${product.id}`)
    await syncShopifyProductToZoho(product)
    console.log(`[ZohoSync Job] done product → ${product.id}`)
    await new Promise(r => setTimeout(r, 1200))
  }

  console.log('[ZohoSync Job] all done')
}
