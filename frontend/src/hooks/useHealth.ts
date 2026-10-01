import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';

export function useHealth() {
  const [status, setStatus] = useState('checking…');
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/health`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok || j?.status !== 'ok') throw new Error(`unexpected response (HTTP ${r.status})`);
        return j;
      })
      .then(j => { if (alive) setStatus(`ok (${j.time})`); })
      .catch(e => { if (alive) setStatus(`error: ${e.message}`); });
    return () => { alive = false; };
  }, []);
  return status;
}
