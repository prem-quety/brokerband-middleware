import fs from "fs/promises";
import { parseStringPromise, Builder } from "xml2js";

/* ===========================
    LOGGING
=========================== */
export const log = (level, message, ...args) => {
  const time = new Date().toISOString();
  console[level](`[${time}] ${message}`, ...args);
};

/* ===========================
    FILE READ/WRITE
=========================== */
export const readJSON = async (path) =>
  JSON.parse(await fs.readFile(path, "utf8"));
export const writeJSON = async (path, data) =>
  fs.writeFile(path, JSON.stringify(data, null, 2));

/* ===========================
    XML PARSING
=========================== */
export const parseXML = async (xml) => await parseStringPromise(xml);
export const buildXML = (obj) => new Builder().buildObject(obj);

/* ===========================
    ERROR HANDLING
=========================== */
export const extractError = (err) => {
  return err?.response?.data || err?.message || "Unknown error";
};

/* ===========================
    STRING UTILS
=========================== */
export const slugify = (text) => text.toLowerCase().replace(/\s+/g, "-");
export const titleCase = (str) =>
  str.replace(/\b\w/g, (char) => char.toUpperCase());
