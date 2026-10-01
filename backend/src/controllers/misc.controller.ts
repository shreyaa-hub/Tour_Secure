import { Request, Response } from 'express';
import Review from "../models/Review";

import Itinerary from '../models/itinerary.model';
import EFIR from '../models/efir.model';

// Reviews
export async function createReview(req: Request, res: Response) {
  try { const r = await Review.create(req.body); res.status(201).json(r); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
}
export async function listReviews(_req: Request, res: Response) {
  const list = await Review.find().sort({ createdAt: -1 }).limit(50);
  res.json(list);
}

// Itinerary
export async function addItinerary(req: Request, res: Response) {
  try { const it = await Itinerary.create(req.body); res.status(201).json(it); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
}
export async function listItinerary(_req: Request, res: Response) {
  const list = await Itinerary.find().sort({ createdAt: -1 }).limit(100);
  res.json(list);
}

// e-FIR
export async function createEFIR(req: Request, res: Response) {
  try { const doc = await EFIR.create(req.body); res.status(201).json(doc); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
}
// e-FIR
export async function listEFIR(_req: Request, res: Response) {
  const list = await EFIR.find().sort({ createdAt: -1 }).limit(100);
  res.json(list);
}
