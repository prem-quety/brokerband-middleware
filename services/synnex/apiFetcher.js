import axios from "axios";
import path from "path";
import { writeFile } from "fs/promises";
import { buildXML, parseXML, log, extractError } from "../../utils/helpers.js";

const SYNNEX_URL = "https://ec.ca.tdsynnex.com/SynnexXML/PriceAvailability";

export const fetchSynnexPriceData = async (synnexSKU) => {
  synnexSKU = synnexSKU.trim();
  try {
    const requestXML = buildXML({
      priceRequest: {
        $: { version: "2.8" },
        customerNo: process.env.SYNNEX_CUSTOMER_NO,
        userName: process.env.SYNNEX_USERNAME,
        password: process.env.SYNNEX_PASSWORD,
        skuList: { synnexSKU, lineNumber: 1 },
      },
    });

    const { data: rawXML } = await axios.post(SYNNEX_URL, requestXML, {
      headers: { "Content-Type": "application/xml" },
    });

    await writeFile(`./logs/xml/${synnexSKU}.xml`, rawXML);
    const parsed = await parseXML(rawXML);
    const product = parsed?.priceResponse?.PriceAvailabilityList?.[0];

    if (!product) return null;

    const status =
      product.status?.[0]?.toLowerCase() ||
      product.GlobalProductStatusCode?.[0]?.toLowerCase();

    if (["not found", "discontinued", "notauthorized"].includes(status))
      return null;

    const price = parseFloat(product.price?.[0] || "0");
    let msrp = parseFloat(product.msrp?.[0]);

    if (isNaN(msrp) || msrp === 0) {
      msrp = parseFloat((price * 1.1).toFixed(2));
      log(
        "warn",
        `MSRP missing for SKU ${synnexSKU}, defaulted to price * 1.1`
      );
    }

    const warehouses = (product.AvailabilityByWarehouse || []).map((entry) => ({
      city: entry.warehouseInfo?.[0]?.city?.[0],
      qty: parseInt(entry.qty?.[0] || 0),
    }));

    return {
      synnexSKU: product.synnexSKU?.[0],
      mfgPN: product.mfgPN?.[0],
      description: product.description?.[0],
      price,
      msrp,
      quantity: product.totalQuantity?.[0],
      weight: product.weight?.[0],
      parcelShippable: product.parcelShippable?.[0],
      warehouses,
      status,
    };
  } catch (err) {
    log("error", "Failed to fetch SYNNEX product:", extractError(err));
    return null;
  }
};
