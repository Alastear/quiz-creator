import { env } from "@/lib/env";
import type { MediaStorage } from "./types";
import { localStorage } from "./local";
import { blobStorage } from "./blob";

// เลือก driver ตาม STORAGE_DRIVER (DESIGN.md ข้อ 6.2)
export const storage: MediaStorage =
  env.STORAGE_DRIVER === "blob" ? blobStorage : localStorage;

export type { MediaStorage, PutInput, PutResult } from "./types";
