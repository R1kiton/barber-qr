import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { connection } from "next/server";
import type { Db, PublicShop, Shop } from "./types";
import { hashPin } from "./auth";

// Base de datos en un archivo JSON: suficiente para empezar.
// Para producción, sustituir estas funciones por una base de datos real (Postgres, SQLite…).
const FILE = path.join(process.cwd(), "data", "db.json");

function seed(): Db {
  return {
    shops: [
      {
        id: randomUUID(),
        slug: "barberia-demo",
        name: "Barbería Demo",
        address: "Av. Principal 123",
        phone: "555 123 4567",
        pinHash: hashPin("1234"),
        openTime: "09:00",
        closeTime: "19:00",
        workDays: [1, 2, 3, 4, 5, 6],
        services: [
          { id: randomUUID(), name: "Corte clásico", durationMin: 30, price: 150 },
          { id: randomUUID(), name: "Fade / degradado", durationMin: 45, price: 180 },
          { id: randomUUID(), name: "Arreglo de barba", durationMin: 30, price: 120 },
          { id: randomUUID(), name: "Corte + barba", durationMin: 60, price: 250 },
        ],
        barbers: [
          { id: randomUUID(), name: "Carlos" },
          { id: randomUUID(), name: "Miguel" },
        ],
        createdAt: new Date().toISOString(),
      },
    ],
    appointments: [],
  };
}

async function load(): Promise<Db> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as Db;
  } catch {
    const db = seed();
    await save(db);
    return db;
  }
}

async function save(db: Db) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2));
  await fs.rename(tmp, FILE);
}

// Cola para que las escrituras no se pisen (evita reservas dobles dentro del mismo proceso).
let queue: Promise<unknown> = Promise.resolve();

export function mutate<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await load();
    const result = await fn(db);
    await save(db);
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

export async function readDb(): Promise<Db> {
  await connection();
  await queue;
  return load();
}

export async function getShop(slug: string): Promise<Shop | undefined> {
  const db = await readDb();
  return db.shops.find((s) => s.slug === slug);
}

export function toPublic(shop: Shop): PublicShop {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { pinHash, ...rest } = shop;
  return rest;
}

export const newId = () => randomUUID();
