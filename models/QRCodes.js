var mongoose = require("mongoose");
const AutoIncrement = require("mongoose-sequence")(mongoose);

var qrCodeSchema = new mongoose.Schema(
  {
    createdAt: { type: String, required: true },
    contentType: { type: String, sparse: true },
    user_email: { type: String, unique: true, sparse: true },
    user_name: { type: String, sparse: true },
    video_ID: { type: String, unique: true, sparse: true },
    video_URL: { type: String, unique: true, sparse: true },
  },
  { collection: "qrCode" }
);

qrCodeSchema.plugin(AutoIncrement, { inc_field: "qrCode_ID" });

module.exports = mongoose.model("QRCode", qrCodeSchema);
