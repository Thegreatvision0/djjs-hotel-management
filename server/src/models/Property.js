import mongoose from "mongoose";

// A "Bhawan" — a building/property managed by the hotel.
const propertySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true }, // AB, DSB, GH
    name: { type: String, required: true },
    // Default nightly rate per room type when a room has no explicit rate.
    defaultRates: { type: Map, of: Number, default: {} },
    floors: [Number],
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Property", propertySchema);
