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
  shopId: string;
  serviceId: string;
  barberId: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  customerName: string;
  customerPhone: string;
  status: AppointmentStatus;
  createdAt: string;
  checkedInAt?: string; // cuando la barbería escaneó el QR del cliente
};

/** Código corto que acompaña al QR (por si la cámara falla). */
export const shortCode = (id: string) => id.replace(/-/g, "").slice(0, 6).toUpperCase();

export type Db = {
  shops: Shop[];
  appointments: Appointment[];
};
