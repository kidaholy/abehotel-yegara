import { db } from "./json-db";

export const prisma = db as any; // Cast as 'any' to avoid massive TS errors while transitioning

