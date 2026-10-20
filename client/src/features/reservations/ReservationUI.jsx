import { createContext, useCallback, useContext, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ReservationDrawer from "./ReservationDrawer";
import ReservationForm from "./ReservationForm";

// Lets any page open a booking (drawer, deep-linkable via ?res=<id>) or the new-booking form.
const Ctx = createContext(null);

export function ReservationUIProvider({ children }) {
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState(null); // { reservation?, prefill? }
  const resId = params.get("res");

  const openReservation = useCallback((id) => setParams((p) => { p.set("res", id); return p; }), [setParams]);
  const closeReservation = useCallback(() => setParams((p) => { p.delete("res"); return p; }), [setParams]);
  const openNew = useCallback((prefill = {}) => setForm({ prefill }), []);
  const openEdit = useCallback((reservation) => setForm({ reservation }), []);

  return (
    <Ctx.Provider value={{ openReservation, openNew, openEdit }}>
      {children}
      {resId && <ReservationDrawer id={resId} onClose={closeReservation} />}
      {form && (
        <ReservationForm
          {...form}
          onClose={() => setForm(null)}
          onSaved={(r) => { setForm(null); openReservation(r._id); }}
        />
      )}
    </Ctx.Provider>
  );
}

export const useReservationUI = () => useContext(Ctx);
