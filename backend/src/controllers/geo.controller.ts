import { Request, Response } from "express";
import Zone from "../models/zone.model";
import { z } from "zod";

const zoneSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  riskLevel: z.enum(["low", "medium", "high"]),
  riskScore: z.number().min(0).max(100),
  polygon: z.object({
    type: z.literal("Polygon").default("Polygon"),
    coordinates: z.array(z.array(z.array(z.number()))),
  }),
});

export async function createZone(req: Request, res: Response) {
  try {
    const parsed = zoneSchema.parse(req.body);
    const zone = await Zone.create(parsed);
    return res.status(201).json(zone);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

export async function listZones(_req: Request, res: Response) {
  const zones = await Zone.find().sort({ createdAt: -1 });
  res.json(zones);
}

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export async function checkPoint(req: Request, res: Response) {
  try {
    const { lat, lng } = pointSchema.parse(req.body);

    const zones = await Zone.find({
      polygon: {
        $geoIntersects: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
        },
      },
    });

    if (zones.length === 0) {
      return res.json({
        inside: false,
        riskLevel: "safe",
        riskScore: 0,
        matchedZones: [],
      });
    }

    const top = zones.reduce((a, b) => (a.riskScore >= b.riskScore ? a : b));

    return res.json({
      inside: true,
      riskLevel: top.riskLevel,
      riskScore: top.riskScore,
      matchedZones: zones.map((z) => ({
        id: z._id,
        name: z.name,
        description: z.description ?? "",
        riskLevel: z.riskLevel,
        riskScore: z.riskScore,
      })),
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}
