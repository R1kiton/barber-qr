/**
 * El panel comparte la paleta del sitio pero no su ropa de marketing: aqui los
 * botones son controles de trabajo, no listones. `contents` hace que este div
 * no exista para el layout, solo aporta la clase que cambia el estilo.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="ui-plain contents">{children}</div>;
}
