import { Schema, model, Document, Types } from "mongoose";

export interface IEfir extends Document {
  name?: string;
  contact?: string;
  summary: string;
  attachments?: string[];
  location?: {
    lat?: number;
    lng?: number;
  };
  status: "Pending" | "Submitted" | "Closed";
  user: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EfirSchema = new Schema<IEfir>(
  {
    name: { type: String, trim: true },
    contact: { type: String, trim: true },

    // Make summary optional with a safe default so it never blocks writes.
    summary: { type: String, trim: true, default: "" },

    attachments: [{ type: String }],
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    status: {
      type: String,
      enum: ["Pending", "Submitted", "Closed"],
      default: "Pending",
    },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, collection: "efir_reports" }
);

EfirSchema.index({ user: 1, createdAt: -1 });

export default model<IEfir>("Efir", EfirSchema);
