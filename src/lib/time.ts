// Utilidades de fecha/hora sin dependencias de Node (se usan en cliente y servidor).
// Las fechas se guardan como "YYYY-MM-DD" y las horas como "HH:MM" en la hora local de la barbería.

export const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const DAY_LONG = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export function localDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parse(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateStr: string, n: number) {
  const d = parse(dateStr);
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

export const weekday = (dateStr: string) => parse(dateStr).getDay();
export const dayOfMonth = (dateStr: string) => parse(dateStr).getDate();

export function formatDateLong(dateStr: string) {
  return new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parse(dateStr));
}

export function monthShort(dateStr: string) {
  return new Intl.DateTimeFormat("es", { month: "short" }).format(parse(dateStr)).replace(".", "");
}

export const isValidDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && localDateStr(parse(s)) === s;
export const isValidTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

export const formatPrice = (n: number) => `$${n.toLocaleString("es")}`;
