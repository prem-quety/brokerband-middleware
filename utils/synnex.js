import { create, convert } from "xmlbuilder2";


export const buildSynnexPO = (order) => {
  try {
    if (!order || !order.shipping_address || !order.line_items?.length) {
      throw new Error("Missing required fields: shipping_address or line_items");
    }

    const { shipping_address, email, id, line_items } = order;

    const state = shipping_address.province_code || "NA";
    const zip = shipping_address.zip || "00000";
    const country = shipping_address.country_code || "US";
    const contactName = shipping_address.name || "Unnamed";
    const phone = shipping_address.phone || "0000000000";
    const emailAddress = email || "no-reply@example.com";

    const doc = create({ version: "1.0", encoding: "UTF-8" });
    const root = doc.ele("SynnexB2B");

    // <Credential>
    const credential = root.ele("Credential");
    credential.ele("UserID").txt(process.env.SYNNEX_USERNAME || "MISSING_USERNAME");
    credential.ele("Password").txt(process.env.SYNNEX_PASSWORD || "MISSING_PASSWORD");

    // <OrderRequest>
    const orderRequest = root.ele("OrderRequest");
    orderRequest.ele("CustomerNumber").txt(process.env.SYNNEX_CUSTOMER_NO || "MISSING_CUST_NO");
    orderRequest.ele("PONumber").txt(`BB-${id}`);
    orderRequest.ele("DropShipFlag").txt("Y");

    // <Shipment>
    const shipment = orderRequest.ele("Shipment");

    const shipTo = shipment.ele("ShipTo");
    shipTo.ele("AddressName1").txt(contactName);
    shipTo.ele("AddressLine1").txt(shipping_address.address1 || "UNKNOWN_ADDRESS");
    shipTo.ele("City").txt(shipping_address.city || "UNKNOWN_CITY");
    shipTo.ele("State").txt(state);
    shipTo.ele("ZipCode").txt(zip);
    shipTo.ele("Country").txt(country);

    const contact = shipment.ele("ShipToContact");
    contact.ele("ContactName").txt(contactName);
    contact.ele("PhoneNumber").txt(phone);
    contact.ele("EmailAddress").txt(emailAddress);

    const shipMethod = shipment.ele("ShipMethod");
    shipMethod.ele("Code").txt("FG"); // Default: Standard Ground

    // <Payment>
    const payment = orderRequest.ele("Payment");
    payment.ele("BillTo", { code: process.env.SYNNEX_CUSTOMER_NO || "MISSING_CUST_NO" });

    // <Items>
    const itemsNode = orderRequest.ele("Items");

    line_items.forEach((item, idx) => {
      const sku = item.sku || "UNKNOWN-SKU";
      const quantity = item.quantity || "1";

      if (!sku) throw new Error(`Missing SKU in line item ${idx}`);

      const itemNode = itemsNode.ele("Item", { lineNumber: idx + 1 });
      itemNode.ele("SKU").txt(sku);
      itemNode.ele("UnitPrice").txt("0.00"); // STOP leaking customer pricing
      itemNode.ele("OrderQuantity").txt(quantity);

      // Optional: <Attributes> block — enable if needed for Cisco, Apple, licenses, etc.
      // const attributes = itemNode.ele("Attributes");
      // attributes.ele("Attribute", { name: "ENDUSER", value: "Brokerband Inc." });
      // attributes.ele("Attribute", { name: "CUSTOMERPARTNO", value: "BB-CUST-001" });
    });

    return doc.end({ prettyPrint: true });

  } catch (err) {
    console.error(`[buildSynnexPO] Failed to build XML for order ${order?.id}: ${err.message}`);
    throw err;
  }
};




export const parseSynnexResponse = (xmlString) => {
  try {
    const json = convert(xmlString, { format: "object" });

    const response = json?.SynnexB2B?.OrderResponse || {};

 const orderInfo = {
  customerNumber: response.CustomerNumber || null,
  poNumber: response.PONumber || null,
  statusCode: response.Code || "unknown",
  reason: response.Reason || null, // <-- add this line
  responseTime: response.ResponseDateTime || null,
  responseElapsed: response.ResponseElapsedTime || null,
  items: [],
};


    const rawItems = response.Items?.Item || [];

    // Normalize: If only one item, xmlbuilder2 returns it as an object instead of an array
    const itemList = Array.isArray(rawItems) ? rawItems : [rawItems];

    itemList.forEach((item) => {
      orderInfo.items.push({
  lineNumber: item?.["@lineNumber"] || null,
  sku: item?.SKU || null,
  quantity: item?.OrderQuantity || null,
  code: item?.Code || null,
  reason: item?.Reason || null, // <-- include item-level reason too
  synnexOrderNumber: item?.OrderNumber || null,
  orderType: item?.OrderType || null,
  warehouse: item?.ShipFromWarehouse || null,
  internalReference: item?.SynnexInternalReference || null,
});

    });

    return orderInfo;
  } catch (err) {
    console.error("[parseSynnexResponse] Failed to parse response:", err);
    return {
      error: true,
      message: "Invalid SYNNEX response XML",
      details: err.message,
    };
  }
};
