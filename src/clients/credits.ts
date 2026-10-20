import { authorizedFetch } from '../platform/api';

export const creditClient = {
  async getBalance(): Promise<{ success: boolean; balance?: number; error?: string }> {
    try {
      const res = await authorizedFetch('/api/credits/balance');
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err?.message || '获取额度失败' };
    }
  },
  async listEntries(): Promise<{ success: boolean; list?: any[]; error?: string }> {
    try {
      const res = await authorizedFetch('/api/credits/entries');
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err?.message || '获取额度流水失败' };
    }
  },
  async consume(kind: 2 | 3, amount: number): Promise<{ success: boolean; balance?: number; error?: string; code?: string }> {
    try {
      const res = await authorizedFetch('/api/credits/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, amount }),
      });
      const data = await res.json();
      if (!res.ok) return data;
      return data;
    } catch (err: any) {
      return { success: false, error: err?.message || '扣除失败' };
    }
  },
  async restore(amount: number): Promise<{ success: boolean; balance?: number; error?: string; code?: string }> {
    try {
      const res = await authorizedFetch('/api/credits/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) return data;
      return data;
    } catch (err: any) {
      return { success: false, error: err?.message || '返还失败' };
    }
  }
};