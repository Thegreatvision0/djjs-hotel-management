import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "./client";

export const useMeta = () => useQuery({ queryKey: ["meta"], queryFn: () => api.get("/meta"), staleTime: 5 * 60_000 });

export const useApiQuery = (key, url, params, opts = {}) =>
  useQuery({ queryKey: [key, url, params], queryFn: () => api.get(url, { params }), ...opts });

// Mutations invalidate everything operational by default: reservation actions
// ripple into rooms, billing, dashboard and housekeeping.
const OPERATIONAL = ["reservations", "reservation", "rooms", "room", "billing", "dashboard", "availability", "guests", "housekeeping", "pos", "counts", "freeRooms", "audit"];

export function useApiMutation(fn, { success, invalidate = OPERATIONAL, onSuccess, onError } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data, vars) => {
      invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      if (success) toast.success(typeof success === "function" ? success(data, vars) : success);
      onSuccess?.(data, vars);
    },
    onError: (err, vars) => {
      if (onError) onError(err, vars);
      else toast.error(err.message);
    },
  });
}
