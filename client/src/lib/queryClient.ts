import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Cache durations in milliseconds
const STALE_TIME = {
  CREDENTIALS: 5 * 60 * 1000,  // 5 minutes for credentials check
  FOLDERS: 5 * 60 * 1000,      // 5 minutes for folder data
  VIDEOS: 60 * 1000,           // 1 minute for video data
  PRESETS: 10 * 60 * 1000,     // 10 minutes for presets
  DEFAULT: 2 * 60 * 1000,      // 2 minutes default
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true, // Refetch when user returns to tab
      staleTime: STALE_TIME.DEFAULT, // Data considered fresh for 2 minutes
      gcTime: 10 * 60 * 1000, // Keep unused data in cache for 10 minutes
      retry: 1, // Retry failed requests once
      retryDelay: 1000, // Wait 1 second before retry
    },
    mutations: {
      retry: false,
    },
  },
});

// Export stale times for use in specific queries
export { STALE_TIME };
