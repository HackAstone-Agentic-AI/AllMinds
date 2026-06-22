const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

async function request<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('allminds_token');
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('allminds_token');
      localStorage.removeItem('allminds_user');
      window.dispatchEvent(new Event('allminds:session-expired'));
    }
    throw new Error(error.error || `API request failed (${res.status})`);
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

  // Profile
  getProfile: () => request('/profile'),
  updateProfile: (data: any) => request('/profile', { method: 'PUT', body: JSON.stringify(data) }),
  getCalendarStatus: () => request('/calendar/status'),
  getCalendarConnectUrl: () => request('/calendar/connect?format=json'),
  disconnectCalendar: () => request('/calendar/disconnect', { method: 'DELETE' }),

  // Learners
  getLearners: () => request('/learners'),
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
  deleteScheduleItem: (id: number) =>
    request(`/activities/schedule-items/${id}`, { method: 'DELETE' }),

  // NGOs & Strategies (if used elsewhere)
  getNGOs: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params) : '';
    return request(`/ngos${query}`);
  },
  getStrategies: () => request('/strategies'),
  createStrategy: (data: any) => request('/strategies', { method: 'POST', body: JSON.stringify(data) }),
  voteStrategy: (id: number) => request(`/strategies/${id}/vote`, { method: 'POST' }),

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
