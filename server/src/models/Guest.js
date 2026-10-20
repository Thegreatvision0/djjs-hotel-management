import mongoose from "mongoose";

// Guest profile — deduplicated by phone number. Reservations reference it, so returning
// guests are recognised and their ID / address details are reused.
const guestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    countryCode: { type: String, default: "+91" },
    mobile: { type: String, required: true }, // digits only
    email: { type: String, lowercase: true, trim: true },
    dob: String,
    gender: String,
    address: String,
    nationality: { type: String, default: "Indian" },
    idType: String,
    idNumber: String,
    isVIP: { type: Boolean, default: false },
    notes: String,
  },
  { timestamps: true }
);

guestSchema.index({ countryCode: 1, mobile: 1 }, { unique: true });
guestSchema.index({ name: "text" });

export default mongoose.model("Guest", guestSchema);
