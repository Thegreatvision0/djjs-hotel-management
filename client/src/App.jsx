import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth, ROLE_HOME } from "./context/AuthContext";
import { Loading } from "./components/ui";
import AppLayout from "./layouts/AppLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ReservationsPage from "./pages/ReservationsPage";
import AvailabilityPage from "./pages/AvailabilityPage";
import GuestsPage from "./pages/GuestsPage";
import RoomsPage from "./pages/RoomsPage";
import BillingPage from "./pages/BillingPage";
import HousekeepingPage from "./pages/HousekeepingPage";
import PosPage from "./pages/PosPage";
import UsersPage from "./pages/UsersPage";
import ReportsPage from "./pages/ReportsPage";
import PrintPage from "./pages/PrintPage";
import { ACCESS } from "./lib/access";

function Guard({ section, children }) {
  const { user } = useAuth();
  if (!ACCESS[section].includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return children;
}

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="grid h-screen place-items-center"><Loading label="Starting…" /></div>;
  if (!user) return <Routes><Route path="*" element={<LoginPage />} /></Routes>;

  const g = (section, el) => <Guard section={section}>{el}</Guard>;
  return (
    <Routes>
      <Route path="/print/:kind/:id" element={g("billing", <PrintPage />)} />
      <Route element={<AppLayout />}>
        <Route index element={user.role === "Admin" || user.role === "Front Desk" ? <DashboardPage /> : <Navigate to={ROLE_HOME[user.role]} replace />} />
        <Route path="reservations" element={g("reservations", <ReservationsPage />)} />
        <Route path="availability" element={g("availability", <AvailabilityPage />)} />
        <Route path="guests" element={g("guests", <GuestsPage />)} />
        <Route path="rooms" element={g("rooms", <RoomsPage />)} />
        <Route path="billing" element={g("billing", <BillingPage />)} />
        <Route path="housekeeping" element={g("housekeeping", <HousekeepingPage />)} />
        <Route path="pos" element={g("pos", <PosPage />)} />
        <Route path="users" element={g("users", <UsersPage />)} />
        <Route path="reports" element={g("reports", <ReportsPage />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
