import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import {
  generateStableUserId,
  loadDatabase,
  saveDatabase,
  type OtherExpenseItem,
  type SettingsRecord,
  type TripRecord,
  type UserRecord,
  type VehicleRecord,
} from "./db";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ success: false, message, error: { message, status } }, status);
}

function parseBearerToken(authHeader: string | null): string {
  if (!authHeader) return "";
  const parts = authHeader.split(" ");
  if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
    return parts[1].trim();
  }
  return authHeader.trim();
}

function getAuthUserFromToken(token: string): UserRecord | null {
  if (!token) return null;
  const db = loadDatabase();

  // Token format: "jwt_<userId>_<timestamp>" or standard token
  if (token.startsWith("jwt_")) {
    const lastUnderscore = token.lastIndexOf("_");
    if (lastUnderscore > 4) {
      const userId = token.slice(4, lastUnderscore);
      const user = db.users.find((u) => u.id === userId);
      if (user) return user;
    }
    // Fallback if token was jwt_<userId> without timestamp
    const fallbackId = token.slice(4);
    const userFallback = db.users.find((u) => u.id === fallbackId);
    if (userFallback) return userFallback;
  }

  // Token format: token string matching user ID directly or stored in db
  const found = db.users.find((u) => u.id === token);
  return found || null;
}

export async function handleApiFetch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  const authHeader = request.headers.get("authorization");
  const token = parseBearerToken(authHeader);
  const authUser = getAuthUserFromToken(token);

  // 1. Health check
  if (path === "/api/health" && method === "GET") {
    return jsonResponse({
      success: true,
      data: { status: "ok", database: "connected" },
    });
  }

  // 2. Authentication: Register
  if (path === "/api/auth/register" && method === "POST") {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
      fullName?: string;
      mobile?: string;
    };
    const email = (body.email || "").trim().toLowerCase();
    if (!email) return errorResponse("Email is required.", 400);

    const db = loadDatabase();
    const existing = db.users.find((u) => u.email.toLowerCase() === email);
    if (existing) {
      return errorResponse("An account with this email already exists.", 400);
    }

    const userId = generateStableUserId(email);
    const newUser: UserRecord = {
      id: userId,
      email,
      password: body.password || "",
      fullName: (body.fullName || "").trim(),
      mobile: (body.mobile || "").trim(),
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    saveDatabase(db);

    const session = {
      access_token: `jwt_${userId}_${Date.now()}`,
      token_type: "bearer",
      expires_in: 3600 * 24 * 30,
      user: newUser,
    };

    return jsonResponse({ success: true, data: { user: newUser, session } }, 201);
  }

  // 3. Authentication: Login
  if (path === "/api/auth/login" && method === "POST") {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    if (!email || !password) {
      return errorResponse("Email and password are required.", 400);
    }

    const db = loadDatabase();
    const user = db.users.find((u) => u.email.toLowerCase() === email);

    // CRITICAL: Never create a new user on login!
    if (!user) {
      return errorResponse("Invalid email or password.", 400);
    }

    if (user.password && user.password !== password) {
      return errorResponse("Invalid email or password.", 400);
    }

    const session = {
      access_token: `jwt_${user.id}_${Date.now()}`,
      token_type: "bearer",
      expires_in: 3600 * 24 * 30,
      user,
    };

    return jsonResponse({ success: true, data: { user, session } });
  }

  // 4. Current user session
  if (path === "/api/auth/me" && method === "GET") {
    if (!authUser) return errorResponse("Authentication is required.", 401);
    return jsonResponse({ success: true, data: { user: authUser } });
  }

  // 4b. Update user profile/password directly in database
  if (
    (path === "/api/auth/update" || path === "/api/auth/profile") &&
    (method === "POST" || method === "PUT")
  ) {
    if (!authUser) return errorResponse("Authentication is required.", 401);
    const body = (await request.json().catch(() => ({}))) as {
      password?: string;
      fullName?: string;
      mobile?: string;
      user_metadata?: Record<string, unknown>;
    };
    const db = loadDatabase();
    const userIndex = db.users.findIndex((u) => u.id === authUser.id);
    if (userIndex === -1) return errorResponse("User not found.", 404);

    if (body.password) {
      db.users[userIndex].password = body.password;
    }
    if (body.fullName !== undefined) {
      db.users[userIndex].fullName = body.fullName.trim();
    }
    if (body.mobile !== undefined) {
      db.users[userIndex].mobile = body.mobile.trim();
    }

    // Also sync to settings record if fullName or mobile was updated
    const sIndex = db.settings.findIndex((s) => s.userId === authUser.id);
    if (sIndex !== -1) {
      if (body.fullName) db.settings[sIndex].fullName = body.fullName.trim();
      if (body.mobile) {
        db.settings[sIndex].mobileNumber = body.mobile.trim();
        db.settings[sIndex].contactNumber = body.mobile.trim();
      }
    }

    saveDatabase(db);
    const updatedUser = db.users[userIndex];
    const session = {
      access_token: token || `jwt_${updatedUser.id}_${Date.now()}`,
      token_type: "bearer",
      expires_in: 3600 * 24 * 30,
      user: updatedUser,
    };
    return jsonResponse({ success: true, data: { user: updatedUser, session } });
  }

  // 4c. Reset password endpoint
  if (path === "/api/auth/reset-password" && method === "POST") {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      newPassword?: string;
    };
    const email = (body.email || "").trim().toLowerCase();
    if (!email) return errorResponse("Email is required.", 400);

    const db = loadDatabase();
    const userIndex = db.users.findIndex((u) => u.email.toLowerCase() === email);
    if (userIndex === -1) return errorResponse("No registered account found with this email.", 404);

    if (body.newPassword) {
      db.users[userIndex].password = body.newPassword;
      saveDatabase(db);
      return jsonResponse({ success: true, message: "Password updated successfully." });
    }

    return jsonResponse({ success: true, message: "Account verified for password reset." });
  }

  // 5. Protected routes require valid authenticated user
  if (!authUser) {
    return errorResponse("Authentication is required.", 401);
  }

  const userId = authUser.id;
  const db = loadDatabase();

  // 6. Vehicles API
  if (path === "/api/vehicles") {
    if (method === "GET") {
      const userVehicles = db.vehicles.filter((v) => v.userId === userId);
      return jsonResponse({ success: true, data: userVehicles });
    }

    if (method === "POST") {
      const body = (await request.json().catch(() => ({}))) as Partial<VehicleRecord>;
      const now = new Date().toISOString();
      const newVehicle: VehicleRecord = {
        _id: body._id || `veh_${crypto.randomUUID()}`,
        userId,
        name: (body.name || "").trim(),
        type: (body.type || "Truck").trim(),
        model: (body.model || "").trim(),
        vehicleNumber: (body.vehicleNumber || "").trim(),
        notes: (body.notes || "").trim(),
        isActive: body.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      };

      db.vehicles.push(newVehicle);
      saveDatabase(db);
      return jsonResponse({ success: true, data: newVehicle }, 201);
    }
  }

  if (path.startsWith("/api/vehicles/")) {
    const vehicleId = path.replace("/api/vehicles/", "").split("/")[0];
    const index = db.vehicles.findIndex((v) => v._id === vehicleId && v.userId === userId);

    if (method === "GET") {
      if (index === -1) return errorResponse("Vehicle not found", 404);
      return jsonResponse({ success: true, data: db.vehicles[index] });
    }

    if (method === "PUT") {
      if (index === -1) return errorResponse("Vehicle not found", 404);
      const body = (await request.json().catch(() => ({}))) as Partial<VehicleRecord>;
      const existing = db.vehicles[index];
      const updated: VehicleRecord = {
        ...existing,
        name: body.name !== undefined ? body.name.trim() : existing.name,
        type: body.type !== undefined ? body.type.trim() : existing.type,
        model: body.model !== undefined ? body.model.trim() : existing.model,
        vehicleNumber:
          body.vehicleNumber !== undefined ? body.vehicleNumber.trim() : existing.vehicleNumber,
        notes: body.notes !== undefined ? body.notes.trim() : existing.notes,
        isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
        updatedAt: new Date().toISOString(),
      };
      db.vehicles[index] = updated;
      saveDatabase(db);
      return jsonResponse({ success: true, data: updated });
    }

    if (method === "DELETE") {
      if (index === -1) return errorResponse("Vehicle not found", 404);
      db.vehicles.splice(index, 1);
      const priorTripCount = db.trips.length;
      db.trips = db.trips.filter((t) => !(t.vehicleId === vehicleId && t.userId === userId));
      const deletedTrips = priorTripCount - db.trips.length;
      saveDatabase(db);
      return jsonResponse({ success: true, data: { deletedTrips } });
    }
  }

  // 7. Trips API
  if (path === "/api/trips") {
    if (method === "GET") {
      const vehicleIdParam = url.searchParams.get("vehicleId");
      const fromDate = url.searchParams.get("fromDate");
      const toDate = url.searchParams.get("toDate");

      let trips = db.trips.filter((t) => t.userId === userId);
      if (vehicleIdParam && vehicleIdParam !== "all") {
        trips = trips.filter((t) => t.vehicleId === vehicleIdParam);
      }
      if (fromDate) trips = trips.filter((t) => t.date >= fromDate);
      if (toDate) trips = trips.filter((t) => t.date <= toDate);

      trips.sort((a, b) => b.date.localeCompare(a.date));
      return jsonResponse({ success: true, data: trips });
    }

    if (method === "POST") {
      const body = (await request.json().catch(() => ({}))) as Partial<TripRecord>;
      const now = new Date().toISOString();
      const items: OtherExpenseItem[] = Array.isArray(body.otherExpenseItems)
        ? body.otherExpenseItems.map((i) => ({
            name: String(i.name || "").trim(),
            amount: Number(i.amount) || 0,
          }))
        : [];
      const otherExpenses = items.reduce((sum, i) => sum + i.amount, 0);

      const newTrip: TripRecord = {
        _id: body._id || `trp_${crypto.randomUUID()}`,
        userId,
        vehicleId: String(body.vehicleId || ""),
        date: String(body.date || now.slice(0, 10)),
        income: Number(body.income) || 0,
        diesel: Number(body.diesel) || 0,
        driverPayment: Number(body.driverPayment) || 0,
        emiShare: Number(body.emiShare) || 0,
        otherExpenseItems: items,
        otherExpenses: body.otherExpenses ?? otherExpenses,
        notes: String(body.notes || "").trim(),
        createdAt: now,
        updatedAt: now,
      };

      db.trips.push(newTrip);
      saveDatabase(db);
      return jsonResponse({ success: true, data: newTrip }, 201);
    }
  }

  if (path.startsWith("/api/trips/")) {
    const tripId = path.replace("/api/trips/", "").split("/")[0];
    const index = db.trips.findIndex((t) => t._id === tripId && t.userId === userId);

    if (method === "GET") {
      if (index === -1) return errorResponse("Trip not found", 404);
      return jsonResponse({ success: true, data: db.trips[index] });
    }

    if (method === "PUT") {
      if (index === -1) return errorResponse("Trip not found", 404);
      const body = (await request.json().catch(() => ({}))) as Partial<TripRecord>;
      const existing = db.trips[index];
      const items: OtherExpenseItem[] = Array.isArray(body.otherExpenseItems)
        ? body.otherExpenseItems.map((i) => ({
            name: String(i.name || "").trim(),
            amount: Number(i.amount) || 0,
          }))
        : existing.otherExpenseItems;
      const otherExpenses = items.reduce((sum, i) => sum + i.amount, 0);

      const updated: TripRecord = {
        ...existing,
        vehicleId: body.vehicleId ?? existing.vehicleId,
        date: body.date ?? existing.date,
        income: body.income !== undefined ? Number(body.income) || 0 : existing.income,
        diesel: body.diesel !== undefined ? Number(body.diesel) || 0 : existing.diesel,
        driverPayment:
          body.driverPayment !== undefined
            ? Number(body.driverPayment) || 0
            : existing.driverPayment,
        emiShare: body.emiShare !== undefined ? Number(body.emiShare) || 0 : existing.emiShare,
        otherExpenseItems: items,
        otherExpenses,
        notes: body.notes !== undefined ? String(body.notes).trim() : existing.notes,
        updatedAt: new Date().toISOString(),
      };
      db.trips[index] = updated;
      saveDatabase(db);
      return jsonResponse({ success: true, data: updated });
    }

    if (method === "DELETE") {
      if (index === -1) return errorResponse("Trip not found", 404);
      db.trips.splice(index, 1);
      saveDatabase(db);
      return jsonResponse({ success: true, data: { _id: tripId } });
    }
  }

  // 8. Settings API
  if (path === "/api/settings") {
    let settings = db.settings.find((s) => s.userId === userId);

    if (method === "GET") {
      if (!settings) {
        settings = {
          _id: `set_${userId}`,
          userId,
          appName: authUser.fullName
            ? `${authUser.fullName}'s Fleet`
            : "Vehicle Calculation System",
          transportationName: authUser.fullName ? `${authUser.fullName}'s Transport` : "",
          currency: "INR",
          defaultVehicleId: null,
          fullName: authUser.fullName || "",
          mobileNumber: authUser.mobile || "",
          businessName: authUser.fullName ? `${authUser.fullName} Logistics` : "",
          address: "",
          contactNumber: authUser.mobile || "",
          businessEmail: authUser.email || "",
          updatedAt: new Date().toISOString(),
        };
        db.settings.push(settings);
        saveDatabase(db);
      }
      return jsonResponse({ success: true, data: settings });
    }

    if (method === "PUT") {
      const body = (await request.json().catch(() => ({}))) as Partial<SettingsRecord>;
      const now = new Date().toISOString();
      const unifiedName = (
        body.transportationName ||
        body.businessName ||
        body.appName ||
        settings?.transportationName ||
        settings?.businessName ||
        settings?.appName ||
        "Vehicle Calculation System"
      ).trim();

      const updated: SettingsRecord = {
        _id: settings?._id || `set_${userId}`,
        userId,
        appName: unifiedName,
        transportationName: unifiedName,
        businessName: unifiedName,
        currency: body.currency || settings?.currency || "INR",
        defaultVehicleId: body.defaultVehicleId ?? settings?.defaultVehicleId ?? null,
        fullName: (body.fullName ?? settings?.fullName ?? authUser.fullName).trim(),
        mobileNumber: (body.mobileNumber ?? settings?.mobileNumber ?? authUser.mobile).trim(),
        address: (body.address ?? settings?.address ?? "").trim(),
        contactNumber: (body.contactNumber ?? settings?.contactNumber ?? authUser.mobile).trim(),
        businessEmail: (body.businessEmail ?? settings?.businessEmail ?? authUser.email).trim(),
        updatedAt: now,
      };

      const sIndex = db.settings.findIndex((s) => s.userId === userId);
      if (sIndex === -1) db.settings.push(updated);
      else db.settings[sIndex] = updated;
      saveDatabase(db);
      return jsonResponse({ success: true, data: updated });
    }
  }

  // 9. Sync Client Records into Server DB
  if (path === "/api/sync" && method === "POST") {
    const payload = (await request.json().catch(() => ({}))) as {
      vehicles?: VehicleRecord[];
      trips?: TripRecord[];
      settings?: Partial<SettingsRecord>;
    };

    let importedVehicles = 0;
    let importedTrips = 0;

    if (Array.isArray(payload.vehicles)) {
      for (const v of payload.vehicles) {
        const match = db.vehicles.find(
          (ev) =>
            ev.userId === userId &&
            (ev._id === v._id ||
              (ev.vehicleNumber && v.vehicleNumber && ev.vehicleNumber === v.vehicleNumber)),
        );
        if (!match) {
          db.vehicles.push({
            ...v,
            _id: v._id || `veh_${crypto.randomUUID()}`,
            userId,
            isActive: v.isActive ?? true,
            createdAt: v.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          importedVehicles++;
        }
      }
    }

    if (Array.isArray(payload.trips)) {
      for (const t of payload.trips) {
        const match = db.trips.find(
          (et) =>
            et.userId === userId &&
            (et._id === t._id ||
              (et.vehicleId === t.vehicleId && et.date === t.date && et.income === t.income)),
        );
        if (!match) {
          db.trips.push({
            ...t,
            _id: t._id || `trp_${crypto.randomUUID()}`,
            userId,
            createdAt: t.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          importedTrips++;
        }
      }
    }

    if (payload.settings) {
      const sIndex = db.settings.findIndex((s) => s.userId === userId);
      const current = db.settings[sIndex] || {
        _id: `set_${userId}`,
        userId,
        appName: "Vehicle Calculation System",
        transportationName: "",
        currency: "INR",
        defaultVehicleId: null,
        fullName: authUser.fullName,
        mobileNumber: authUser.mobile,
        businessName: "",
        address: "",
        contactNumber: authUser.mobile,
        businessEmail: authUser.email,
        updatedAt: new Date().toISOString(),
      };
      const merged = { ...current, ...payload.settings, updatedAt: new Date().toISOString() };
      if (sIndex === -1) db.settings.push(merged);
      else db.settings[sIndex] = merged;
    }

    saveDatabase(db);
    return jsonResponse({ success: true, data: { importedVehicles, importedTrips } });
  }

  return errorResponse("Not found", 404);
}

export async function handleApiNode(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", async () => {
    try {
      const body = Buffer.concat(chunks);
      const url = `http://${req.headers.host || "localhost:3000"}${req.url || "/"}`;
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (v !== undefined) {
          if (Array.isArray(v)) v.forEach((val) => headers.append(k, val));
          else headers.set(k, v);
        }
      }

      const webRequest = new Request(url, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes((req.method || "").toUpperCase()) ? undefined : body,
      });

      const response = await handleApiFetch(webRequest);
      res.statusCode = response.status;
      response.headers.forEach((v, k) => res.setHeader(k, v));
      const resBuffer = await response.arrayBuffer();
      res.end(Buffer.from(resBuffer));
    } catch (e) {
      console.error("[api-node] error:", e);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: false, message: "Internal server error" }));
    }
  });
}
