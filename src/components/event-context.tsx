"use client";
import * as React from "react";
import { api } from "@/lib/client";

export interface EventContextValue {
  event: any;
  role: string;
  groups: any[];
  gates: any[];
  refresh: () => Promise<void>;
}

const EventContext = React.createContext<EventContextValue | null>(null);

export function EventProvider({ eventId, children }: { eventId: string; children: React.ReactNode }) {
  const [data, setData] = React.useState<any | null>(null);
  const [error, setError] = React.useState("");

  const refresh = React.useCallback(async () => {
    try {
      const d = await api.get<any>(`/api/events/${eventId}`);
      setData(d);
    } catch (e: any) {
      setError(e.message);
    }
  }, [eventId]);

  React.useEffect(() => { refresh(); }, [refresh]);

  if (error) {
    return (
      <div className="rounded-card border border-danger/20 bg-danger/5 p-8 text-center">
        <p className="font-bold text-danger">{error}</p>
        <p className="mt-2 text-sm text-muted">تحقق من الرابط أو صلاحياتك على هذه المناسبة.</p>
      </div>
    );
  }
  if (!data) {
    return <div className="py-20 text-center text-muted">جارٍ تحميل المناسبة…</div>;
  }
  return (
    <EventContext.Provider value={{ event: data.event, role: data.role, groups: data.groups, gates: data.gates, refresh }}>
      {children}
    </EventContext.Provider>
  );
}

export function useEvent(): EventContextValue {
  const ctx = React.useContext(EventContext);
  if (!ctx) throw new Error("useEvent outside EventProvider");
  return ctx;
}
