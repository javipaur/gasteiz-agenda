export async function safeFetch<T = any>(url: string): Promise<T | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
  
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        next: { revalidate: 3600 }, // ISR moderno
      });
  
      clearTimeout(timeout);
  
      if (!res.ok) {
        console.warn(`HTTP ${res.status} → ${url}`);
        return null;
      }
  
      return await res.json();
    } catch (err: any) {
      console.warn(`Fetch failed → ${url}`, err?.message);
      return null;
    }
  }