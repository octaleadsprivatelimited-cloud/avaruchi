import { useCallback, type ComponentProps } from "react";
import {
  Link as RouterLink,
  Navigate as RouterNavigate,
  useLocation as useRouterLocation,
  useNavigate as useRouterNavigate,
} from "react-router";
import { prepareAnalyticsNavigation } from "./analytics";

type Destination = {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
  hash?: string;
  replace?: boolean;
  resetScroll?: boolean;
};
export function destinationHref({ to, params, search, hash }: Destination) {
  const path = to.replace(/\$([A-Za-z0-9_]+)/g, (_, key: string) =>
    encodeURIComponent(params?.[key] || ""),
  );
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(search || {}))
    if (value !== undefined && value !== null && value !== "")
      query.set(key, String(value));
  return `${path}${query.size ? `?${query}` : ""}${hash ? `#${hash.replace(/^#/, "")}` : ""}`;
}

export function Link({
  to,
  params,
  search,
  hash,
  resetScroll = true,
  onClick,
  ...props
}: Omit<ComponentProps<typeof RouterLink>, "to"> & Destination) {
  const href = destinationHref({ to, params, search, hash });
  return (
    <RouterLink
      {...props}
      to={href}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0 ||
          props.target === "_blank"
        )
          return;
        prepareAnalyticsNavigation(new URL(href, window.location.origin).href);
        if (resetScroll && !hash)
          window.scrollTo({ top: 0, behavior: "instant" });
      }}
    />
  );
}

export function useNavigate() {
  const navigate = useRouterNavigate();
  return useCallback(
    async (destination: Destination) => {
      const href = destinationHref(destination);
      prepareAnalyticsNavigation(new URL(href, window.location.origin).href);
      await navigate(href, { replace: destination.replace });
      if (destination.resetScroll !== false && !destination.hash)
        window.scrollTo({ top: 0, behavior: "instant" });
    },
    [navigate],
  );
}

export function useLocation() {
  const location = useRouterLocation();
  return {
    ...location,
    searchStr: location.search,
    href: `${location.pathname}${location.search}${location.hash}`,
  };
}

export function Navigate({ to, search, params, hash, replace }: Destination) {
  return (
    <RouterNavigate
      to={destinationHref({ to, search, params, hash })}
      replace={replace}
    />
  );
}
