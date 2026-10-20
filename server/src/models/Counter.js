import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
const Counter = mongoose.model("Counter", counterSchema);

async function next(key, start = 1000) {
  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    [{ $set: { seq: { $add: [{ $ifNull: ["$seq", start] }, 1] } } }],
    { new: true, upsert: true }
  );
  return doc.seq;
}

const yymmdd = () => new Date().toISOString().slice(2, 10).replace(/-/g, "");

export const nextConfirmationNo = async () => `DJJS-${yymmdd()}-${await next("confirmation")}`;
export const nextReceiptNo = async () => `RCT-${yymmdd()}-${await next("receipt")}`;
export const nextInvoiceNo = async () => `INV-${new Date().getFullYear()}-${String(await next("invoice", 0)).padStart(5, "0")}`;
export const nextOrderNo = async () => `KOT-${await next("pos", 100)}`;

export default Counter;
