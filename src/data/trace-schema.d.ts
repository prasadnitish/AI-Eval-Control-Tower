import type { Trace } from '../schema/types';
export function parseTrace(value: unknown, context?: { tenant_id?: string }): Trace;
