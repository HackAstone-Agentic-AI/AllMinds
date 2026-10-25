const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function request<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('allminds_token');
  const isFormData = options?.body instanceof FormData;
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      // Let the browser set Content-Type automatically for FormData (multipart boundary)
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('allminds_token');
      localStorage.removeItem('allminds_user');
      window.dispatchEvent(new Event('allminds:session-expired'));
    }
    const code: string = body.error || `http_${res.status}`;
    const message: string = body.message || body.error || `API request failed (${res.status})`;
    throw new ApiError(message, code, res.status);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getOAuthUrl: (provider: 'google' | 'microsoft' | 'apple') =>
    `${API_BASE.replace(/\/api$/, '')}/api/auth/${provider}`,
  exchangeOAuthCode: (code: string) =>
    request('/auth/oauth/exchange', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  register: (data: any) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  forgotPassword: (email: string) =>
    request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, new_password: string) =>
    request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, new_password }) }),
  verifyEmail: (token: string) =>
    request('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  resendVerification: (email: string) =>
    request('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }),

  // Profile
  getProfile: () => request('/profile'),
  updateProfile: (data: any) => request('/profile', { method: 'PUT', body: JSON.stringify(data) }),
  getCalendarStatus: () => request('/calendar/status'),
  getCalendarConnectUrl: () => request('/calendar/connect?format=json'),
  disconnectCalendar: () => request('/calendar/disconnect', { method: 'DELETE' }),
  createCalendarEvent: (data: {
    title: string;
    start_time: string;
    notes?: string;
    date?: string;
    duration_minutes?: number;
    recurrence?: 'none' | 'weekdays' | 'daily';
  }) => request('/calendar/events', { method: 'POST', body: JSON.stringify(data) }),

  // Learners
  getLearners: () => request('/learners'),
  getAttentionList: () => request('/learners/attention'),

  // Demo classroom and impact
  loadDemoClassroom: () => request('/demo/classroom', { method: 'POST' }),
  removeDemoClassroom: () => request('/demo/classroom', { method: 'DELETE' }),
  getImpactStats: () => request('/stats/impact'),
  createLearner: (data: any) => request('/learners', { method: 'POST', body: JSON.stringify(data) }),
  bulkUploadLearners: (learners: any[]) =>
    request('/learners/bulk', { method: 'POST', body: JSON.stringify({ learners }) }),

  // Sensory logs
  getSensoryLogs: (learnerId: number) => request(`/learners/${learnerId}/sensory-logs`),
createSensoryLog: (learnerId: number, log: any) =>
  request(`/learners/${learnerId}/sensory-logs`, { method: 'POST', body: JSON.stringify(log) }),

  // Progress
  getProgress: (learnerId: number) => request(`/learners/${learnerId}/progress`),
createProgress: (learnerId: number, data: any) =>
  request(`/learners/${learnerId}/progress`, { method: 'POST', body: JSON.stringify(data) }),

  // Forum
  getForumPosts: () => request('/forum'),
  createForumPost: (data: any) => request('/forum', { method: 'POST', body: JSON.stringify(data) }),
  getForumComments: (postId: number) => request(`/forum/${postId}/comments`),
  createForumComment: (postId: number, content: string) =>
    request(`/forum/${postId}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),

  // Parent Communications
  getParentCommunications: (learnerId?: string) => {
    const query = learnerId ? `?learnerId=${learnerId}` : '';
    return request(`/parent-communications${query}`);
  },
  createParentCommunication: (data: any) =>
    request('/parent-communications', { method: 'POST', body: JSON.stringify(data) }),

  // Activities & Lesson Plans
  getActivities: () => request('/activities/activities'),
  getLessonPlans: () => request('/activities/lesson-plans'),
  getLessonPlan: (id: number) => request(`/activities/lesson-plans/${id}`),
  createLessonPlan: (title: string, content: string) =>
    request('/activities/lesson-plans', { method: 'POST', body: JSON.stringify({ title, content }) }),
  deleteLessonPlan: (id: number) => request(`/activities/lesson-plans/${id}`, { method: 'DELETE' }),
  getTasks: () => request('/activities/tasks'),
  createTask: (data: any) => request('/activities/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id: number, data: any) =>
    request(`/activities/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getScheduleItems: (learnerId: number) =>
    request(`/activities/schedule-items?learnerId=${learnerId}`),
  createScheduleItem: (data: {
    learner_id: number;
    title: string;
    start_time: string;
    notes?: string;
  }) =>
    request('/activities/schedule-items', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateScheduleItem: (id: number, data: { title?: string; start_time?: string; notes?: string }) =>
    request(`/activities/schedule-items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteScheduleItem: (id: number) =>
    request(`/activities/schedule-items/${id}`, { method: 'DELETE' }),

  // NGOs & Strategies (if used elsewhere)
  getNGOs: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params) : '';
    return request(`/ngos${query}`);
  },
  getTrainingResources: () => request('/ngos/training'),
  submitNgoReview: (id: number, rating: number, comment: string) =>
    request(`/ngos/${id}/review`, { method: 'POST', body: JSON.stringify({ rating, comment }) }),
  reportNgo: (id: number, issue: string) =>
    request(`/ngos/${id}/report`, { method: 'POST', body: JSON.stringify({ issue }) }),
  getStrategies: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params) : '';
    return request(`/strategies${query}`);
  },
  createStrategy: (data: any) => request('/strategies', { method: 'POST', body: JSON.stringify(data) }),
  voteStrategy: (id: number) => request(`/strategies/${id}/vote`, { method: 'POST' }),

  // Thandi memory (Next.js proxy -> Express -> agents)
  getAgentMemory: async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('allminds_token') : null;
    const res = await fetch('/api/agent/memory', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Could not load chat history');
    return res.json() as Promise<{ turns: { role: 'user' | 'assistant'; content: string }[]; facts: string[] }>;
  },
  clearAgentMemory: async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('allminds_token') : null;
    const res = await fetch('/api/agent/memory', {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Could not clear chat memory');
  },

  // Streams Thandi's reply: onToken receives text as it is written; resolves with the final payload.
  streamChatWithAgent: async (
    message: string,
    data: Record<string, unknown>,
    onToken: (text: string) => void,
    signal?: AbortSignal,
  ) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('allminds_token') : null;
    const res = await fetch('/api/agent/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message, ...data }),
      signal,
    });
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.detail || 'Agent request failed');
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let done: Record<string, any> | null = null;
    for (;;) {
      const { value, done: finished } = await reader.read();
      if (finished) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      for (const raw of events) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue;
        const event = JSON.parse(line.slice(5).trim());
        if (event.type === 'token') onToken(event.text);
        else if (event.type === 'done') done = event;
      }
    }
    if (!done) throw new Error('The reply was interrupted. Please try again.');
    return done;
  },

  // Agentic AI — calls the Next.js proxy route, not the Express backend
  chatWithAgent: async (message: string, data?: Record<string, unknown>) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('allminds_token') : null;
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message, ...(data || {}) }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.detail || 'Agent request failed');
    }
    return res.json();
  },
};
