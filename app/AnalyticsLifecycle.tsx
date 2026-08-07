"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  ANALYTICS_CONSENT_CHANGE_EVENT,
  getAnalyticsConsent,
  identifyAnalyticsUser,
  initializeAnalytics,
  resetAnalyticsUser,
  trackEvent,
} from "@/lib/analytics";
import { supabase } from "@/lib/supabase";

function getSurface(pathname: string) {
  if (pathname === "/") {
    return "landing";
  }

  return pathname.split("/").filter(Boolean)[0] ?? "unknown";
}

/**
 * Own analytics initialization, navigation tracking, and auth identity in one
 * place so product components remain vendor-neutral.
 */
export default function AnalyticsLifecycle() {
  const pathname = usePathname();

  useEffect(() => {
    initializeAnalytics();

    let alive = true;

    function identifyCurrentSession() {
      if (!supabase) {
        return;
      }

      void supabase.auth.getSession().then(({ data }) => {
        if (alive && data.session) {
          identifyAnalyticsUser(data.session.user.id);
        }
      });
    }

    function syncConsent() {
      if (getAnalyticsConsent() === "granted") {
        initializeAnalytics();
        identifyCurrentSession();
        const currentPathname = window.location.pathname;
        trackEvent("page_view", { surface: getSurface(currentPathname) });
      } else {
        resetAnalyticsUser();
      }
    }

    identifyCurrentSession();
    window.addEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, syncConsent);

    if (!supabase) {
      return () => {
        alive = false;
        window.removeEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, syncConsent);
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) {
        return;
      }

      if (session) {
        identifyAnalyticsUser(session.user.id);
      } else if (event === "SIGNED_OUT") {
        resetAnalyticsUser();
      }
    });

    return () => {
      alive = false;
      window.removeEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, syncConsent);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    trackEvent("page_view", { surface: getSurface(pathname) });
  }, [pathname]);

  return null;
}
