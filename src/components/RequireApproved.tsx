import { Outlet } from "react-router-dom";
import { useProfile } from "../context/ProfileContext";
import Spinner from "./Spinner";
import PendingApproval from "../pages/PendingApproval";

export default function RequireApproved() {
  const { profile, loading } = useProfile();

  if (loading) return <Spinner label="Cargando..." />;
  if (profile && !profile.approved) return <PendingApproval />;

  return <Outlet />;
}
