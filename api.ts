import { TaskPriority, TaskStatus } from './types';

// 默认直连后端 8080，可通过 .env.local 配置 VITE_API_BASE_URL 覆盖
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

type ApiRequestOptions = RequestInit & { token?: string };

export type ApiTask = {
  id: number | string;
  title: string;
  description: string;
  status: string;
  priority?: TaskPriority;
  startDate?: string; // for compatibility
  dueDate?: string; // for compatibility
  startTime?: string; // backend expects startTime/endTime
  endTime?: string;
  durationType?: 'short' | 'long';
  subTasks?: any[];
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
};

const buildUrl = (path: string) => {
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path}`;
};

const ensureHeaders = (headers: HeadersInit | undefined) => new Headers(headers || {});

async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers = ensureHeaders(options.headers);
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);

  const bodyExists = options.body !== undefined && options.body !== null;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const shouldSendJson = bodyExists && !isFormData;

  if (shouldSendJson) headers.set('Content-Type', 'application/json');
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  const normalizedBody = shouldSendJson
    ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
    : options.body;

  const response = await fetch(buildUrl(path), { ...options, headers, body: normalizedBody });
  const clone = response.clone();

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const data = await clone.json();
      message = (data as any)?.message || JSON.stringify(data);
    } catch {
      try {
        const text = await clone.text();
        if (text) message = text;
      } catch {
        /* ignore */
      }
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as unknown as T;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return (await clone.json()) as T;
    } catch {
      // 后端可能宣称 json 但返回纯文本
      try {
        return (await clone.text()) as unknown as T;
      } catch {
        return undefined as unknown as T;
      }
    }
  }
  try {
    return (await clone.text()) as unknown as T;
  } catch {
    return undefined as unknown as T;
  }
}

export const loginRequest = (username: string, password: string) =>
  apiFetch<{ token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });

export const registerRequest = (username: string, password: string) =>
  apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });

export const fetchTasksRequest = (token: string) =>
  apiFetch<ApiTask[]>('/api/tasks', { method: 'GET', token });

export const createTaskRequest = (payload: Partial<ApiTask>, token: string) =>
  apiFetch<ApiTask>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
    token
  });

export const updateTaskRequest = (id: string, payload: Partial<ApiTask>, token: string) =>
  apiFetch<ApiTask>(`/api/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    token
  });

export const deleteTaskRequest = (id: string, token: string) =>
  apiFetch(`/api/tasks/${id}`, {
    method: 'DELETE',
    token
  });

export const mapStatusToApi = (status: TaskStatus) => {
  if (status === TaskStatus.COMPLETED) return 'DONE';
  if (status === TaskStatus.IN_PROGRESS) return 'IN_PROGRESS';
  if (status === TaskStatus.ARCHIVED) return 'ARCHIVED';
  return 'TODO';
};

export const mapStatusFromApi = (status: string): TaskStatus => {
  switch ((status || '').toUpperCase()) {
    case 'DONE':
    case 'COMPLETED':
      return TaskStatus.COMPLETED;
    case 'IN_PROGRESS':
      return TaskStatus.IN_PROGRESS;
    case 'ARCHIVED':
      return TaskStatus.ARCHIVED;
    default:
      return TaskStatus.TODO;
  }
};
