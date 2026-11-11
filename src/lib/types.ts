export type Service = {
  id: string;
  name: string;
  durationMin: number;
  price: number;
};

export type Barber = {
  id: string;
  name: string;
};

export type Shop = {
  id: string;
  slug: string;
  name: string;
  address: string;
  phone: string;
  pinHash: string;
  openTime: string; // "HH:MM"
  closeTime: string; // "HH:MM"
  workDays: number[]; // 0 = domingo … 6 = sábado
  services: Service[];
  barbers: Barber[];
  createdAt: string;
};

export type PublicShop = Omit<Shop, "pinHash">;

export type AppointmentStatus = "confirmada" | "completada" | "cancelada";

export type Appointment = {
  id: string;
  code: string; // código corto bajo el QR
  shopId: string;
  serviceId: string | null;
  barberId: string | null;
  serviceName: string;
  price: number;
  durationMin: number;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  customerName: string;
  customerPhone: string;
  status: AppointmentStatus;
  createdAt: string;
  checkedInAt: string | null; // cuando la barbería escaneó el QR del cliente
};

/** Resumen público de una barbería para el directorio de la portada. */
export type ShopCard = {
  slug: string;
  name: string;
  address: string;
  phone: string;
  openTime: string; // "HH:MM"
  closeTime: string; // "HH:MM"
  workDays: number[]; // 0 = domingo … 6 = sábado
  barbers: number;
  priceFrom: number | null;
  services: string[];
};
