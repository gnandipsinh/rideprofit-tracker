# RideProfit Tracker — Firestore Security Specification

## 1. Data Invariants
1. **Strict Tenant Isolation**: Every user profile, vehicle, trip, and setting document resides under `/users/{userId}` and is readable/writable **only** by the authenticated owner (`request.auth.uid == userId`).
2. **Referential Integrity (Master Gate)**: A trip in `/users/{userId}/trips/{tripId}` cannot be created or updated to reference a non-existent vehicle; the rule verifies `exists(/databases/$(database)/documents/users/$(userId)/vehicles/$(incoming().vehicleId))`.
3. **Immutable Ownership & Timestamps**: `uid` / `userId` and `createdAt` cannot be modified after creation. `createdAt` and `updatedAt` must equal `request.time`.
4. **Financial Safety Bounds**: All monetary and mileage numbers (`income`, `diesel`, `driverPayment`, `emiShare`, `otherExpenses`, `totalKm`, `dieselLiters`) are bounded (`>= 0`, finite upper cap) and `otherExpenseItems` is bounded to `<= 100` items.
5. **Path Hardening**: All document IDs (`userId`, `vehicleId`, `tripId`) must satisfy `isValidId(id)` (`size() <= 128 && matches('^[a-zA-Z0-9_\\-]+$')`).

## 2. "Dirty Dozen" Adversarial Payloads (Must Return `PERMISSION_DENIED`)
1. **Cross-User Read (`GET /users/victim_uid/vehicles/v1`)**: Authenticated as `attacker_uid` -> rejected by `isOwner(userId)`.
2. **Cross-User List (`LIST /users/victim_uid/trips`)**: Authenticated as `attacker_uid` -> rejected by `isOwner(userId) && resource.data.userId == request.auth.uid`.
3. **Owner Spoofing on Create**: `POST /users/attacker_uid/vehicles/v1` with `{ userId: "victim_uid", ... }` -> rejected by `data.userId == request.auth.uid`.
4. **Shadow Field Injection on Create**: `POST /users/u1/vehicles/v1` with extra `{ isAdmin: true }` -> rejected by `data.keys().hasOnly(...)`.
5. **Shadow Update / Affected-Keys Bypass**: `PATCH /users/u1/trips/t1` modifying `createdAt` or `userId` -> rejected by `diff(existing()).affectedKeys().hasOnly(...)` and immutability checks.
6. **Orphaned Trip Creation**: `POST /users/u1/trips/t1` with `{ vehicleId: "non_existent_vehicle", ... }` -> rejected by Master Gate `exists(...)`.
7. **Negative Monetary Value**: `POST /users/u1/trips/t1` with `{ income: -500, ... }` -> rejected by `data.income >= 0`.
8. **Client-Spoofed Timestamp**: `POST /users/u1/vehicles/v1` with client-supplied `createdAt: "2020-01-01"` -> rejected by `incoming().createdAt == request.time`.
9. **ID Poisoning**: Document creation with `vehicleId` containing `/` or `> 128` chars -> rejected by `isValidId(vehicleId)`.
10. **Array Exhaustion (Denial of Wallet)**: Trip payload with `otherExpenseItems` exceeding 100 entries or >255 char item names -> rejected by `size() <= 100` and element check.
11. **Malformed Calendar Date**: Trip with `date: "not-a-date"` or `"2026-99-99"` -> rejected by `^\\d{4}-\\d{2}-\\d{2}$` pattern check.
12. **PII / Profile Cross-Tenant Probe**: Unauthenticated or cross-user read on `/users/{userId}` or `/users/{userId}/settings/app` -> rejected by `isOwner(userId)`.
