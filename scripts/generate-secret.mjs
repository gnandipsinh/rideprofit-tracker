#!/usr/bin/env node
import crypto from "node:crypto";

// Generates a cryptographically strong 32-byte (64-character hex) secret
// Suitable for TOKEN_SECRET or JWT_SECRET on Vercel, Supabase, or other production hosts.
const secret = crypto.randomBytes(32).toString("hex");
console.log(secret);
