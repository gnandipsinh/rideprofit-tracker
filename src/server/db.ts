import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface UserRecord {
  id: string;
  email: string;
  password?: string;
  fullName: string;
  mobile: string;
  createdAt: string;
}

export interface VehicleRecord {
  _id: string;
  userId: string;
  name: string;
  type: string;
  model: string;
  vehicleNumber: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OtherExpenseItem {
  name: string;
  amount: number;
}

export interface TripRecord {
  _id: string;
  userId: string;
  vehicleId: string;
  date: string;
  income: number;
  diesel: number;
  driverPayment: number;
  emiShare: number;
  otherExpenseItems: OtherExpenseItem[];
  otherExpenses: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettingsRecord {
  _id: string;
  userId: string;
  appName: string;
  transportationName: string;
  currency: string;
  defaultVehicleId: string | null;
  fullName: string;
  mobileNumber: string;
  businessName: string;
  address: string;
  contactNumber: string;
  businessEmail: string;
  updatedAt: string;
}

export interface PendingTokenRecord {
  token: string;
  email: string;
  userId: string;
  expiresAt: number;
  used: boolean;
  createdAt: number;
}

interface DatabaseSchema {
  users: UserRecord[];
  vehicles: VehicleRecord[];
  trips: TripRecord[];
  settings: SettingsRecord[];
  pendingTokens: PendingTokenRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

let memoryCache: DatabaseSchema | null = null;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadDatabase(): DatabaseSchema {
  if (memoryCache) return memoryCache;

  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const initial: DatabaseSchema = {
      users: [],
      vehicles: [],
      trips: [],
      settings: [],
      pendingTokens: [],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf8");
    memoryCache = initial;
    return initial;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(raw) as DatabaseSchema;
    memoryCache = {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      vehicles: Array.isArray(parsed.vehicles) ? parsed.vehicles : [],
      trips: Array.isArray(parsed.trips) ? parsed.trips : [],
      settings: Array.isArray(parsed.settings) ? parsed.settings : [],
      pendingTokens: Array.isArray(parsed.pendingTokens) ? parsed.pendingTokens : [],
    };
    return memoryCache;
  } catch (e) {
    console.error("[db] error reading db.json, using empty schema:", e);
    const initial: DatabaseSchema = {
      users: [],
      vehicles: [],
      trips: [],
      settings: [],
      pendingTokens: [],
    };
    memoryCache = initial;
    return initial;
  }
}

export function saveDatabase(data: DatabaseSchema): void {
  ensureDataDir();
  memoryCache = data;
  const tempFile = DB_FILE + ".tmp." + Date.now();
  try {
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tempFile, DB_FILE);
  } catch {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  }
}

export function generateStableUserId(email: string): string {
  const norm = email.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = (hash << 5) - hash + norm.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return `usr_${hex}`;
}
