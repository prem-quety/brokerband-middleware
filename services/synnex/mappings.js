export const mapSynnexToShopify = (item) => {
  const title = item.description || "Unnamed Product";
  const msrp = parseFloat(item.msrp || 0).toFixed(2);
  const compareAtPrice = (msrp * 1.1).toFixed(2);
  const vendor = title.trim().split(" ")[0] || "QueryTel";

  return {
    title,
    body_html: `<p>${title}</p>`,
    vendor,
    product_type: "Adapters",
    tags: ["Adapters"],
    status: "active",
    variants: [
      {
        sku: item.mfgPN,
        price: msrp,
        compare_at_price: compareAtPrice,
        weight: parseFloat(item.weight || 0.5),
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
