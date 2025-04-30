// File: services/synnex/mappings.js (or wherever this function lives)
import { guessProductTags, guessProductType } from "../../utils/helpers.js"; // adjust path if needed

export const mapSynnexToShopify = (item, scraped = {}) => {
  const title = item.description || "Unnamed Product";
  const fullDescription = scraped.description || item.description;

  const type = guessProductType({ description: title, scraped });
  const price = parseFloat(item.msrp || 0).toFixed(2);
  const compareAtPrice = (parseFloat(item.msrp || 0) * 1.1).toFixed(2);
  const weight = parseFloat(item.weight || 0.5);
  const vendor = title.trim().split(" ")[0] || "QueryTel";

  const tags = guessProductTags({
    description: fullDescription,
    brand: vendor,
    scraped,
  });

  return {
    title,
    body_html: `<p>${fullDescription}</p>`,
    vendor,
    product_type: type,
    tags,
    status: "active",
    variants: [
      {
        sku: item.mfgPN,
        price,
        compare_at_price: compareAtPrice,
        weight,
        weight_unit: "lb",
        inventory_quantity: parseInt(item.quantity || 0),
        inventory_management: "shopify",
        fulfillment_service: "manual",
      },
    ],
  };
};

export const buildMetafieldsFromSynnex = (data, product, scraped) => {
  const metafields = [
    {
      namespace: "custom",
      key: "shopify_status",
      value: product.status || "draft",
      type: "single_line_text_field",
    },
    {
      namespace: "custom",
      key: "msrp",
      value: String(data.msrp || 0),
      type: "number_decimal",
    },
    {
      namespace: "custom",
      key: "distributor_price",
      value: String(data.price || 0),
      type: "number_decimal",
    },
    {
      namespace: "custom",
      key: "compatibility",
      value: JSON.stringify({
        type: "root",
        children: [
          {
            type: "paragraph",
            children: [
              {
                type: "text",
                value:
                  "Compatible with Windows. Not supported on macOS, ChromeOS, or Linux.",
              },
            ],
          },
        ],
      }),
      type: "rich_text_field",
    },
    {
      namespace: "custom",
      key: "shipping_info",
      value: JSON.stringify({
        type: "root",
        children: [
          {
            type: "paragraph",
            children: [
              {
                type: "text",
                value:
                  data.parcelShippable === "Y"
                    ? "Parcel shippable."
                    : "Shipping details not available.",
              },
            ],
          },
        ],
      }),
      type: "rich_text_field",
    },
    {
      namespace: "custom",
      key: "warehouse_breakdown",
      value: JSON.stringify({ warehouses: data.warehouses || [] }),
      type: "json",
    },
  ];

  if (scraped?.specifications && Object.keys(scraped.specifications).length) {
    metafields.push({
      namespace: "custom",
      key: "specifications",
      value: JSON.stringify(scraped.specifications),
      type: "json",
    });
  }

  const { upc, unspsc, warranty } = scraped.extraDetails || {};
  if (upc)
    metafields.push({
      namespace: "custom",
      key: "upc",
      value: String(upc),
      type: "single_line_text_field",
    });
  if (unspsc)
    metafields.push({
      namespace: "custom",
      key: "unspsc",
      value: String(unspsc),
      type: "single_line_text_field",
    });

  metafields.push({
    namespace: "custom",
    key: "mfr_pn",
    value: String(data.mfgPN),
    type: "single_line_text_field",
  });
  metafields.push({
    namespace: "custom",
    key: "warranty",
    value: warranty || "Call for Availability",
    type: "single_line_text_field",
  });

  return metafields;
};
