export interface TeacherProfile {
  id: number;
  user_id: number;
  title: string;
  name: string;
  surname: string;
  email: string;
  theme_preference: string;
  language_pref: string;
  created_at: string;
  updated_at: string;
}

export interface LearnerProfile {
  id: number;
  teacher_id: number;
  anonymous_id: string;
  profile_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SensoryToolkitLog {
  id: number;
  learner_id: number;
  teacher_id: number;
  log_data: Record<string, any>;
  logged_at: string;
}

export interface LearnerProgress {
  id: number;
  learner_id: number;
  teacher_id: number;
  progress_data: Record<string, any>;
  recorded_at: string;
}

export interface LessonPlan {
  id: number;
  teacher_id: number;
  title: string;
  content: Record<string, any> | string;
  created_at: string;
}

export interface Assessment {
  id: number;
  teacher_id: number;
  type: string;
  content: Record<string, any>;
  created_at: string;
}

export interface ParentCommunication {
  id: number;
  teacher_id: number;
  learner_id: number;
  type: 'progress' | 'concern';
  content: string;
  created_at: string;
  learner_anonymous_id?: string;
  learner_profile_data?: Record<string, any>;
}

export interface ForumPost {
  id: number;
  teacher_id: number;
  title: string;
  content: string;
  created_at: string;
  author_name?: string;
}

export interface Activity {
  id: number;
  teacher_id: number;
  activity_type: string;
  description: string;
  created_at: string;
}

export interface TeacherTask {
  id: number;
  teacher_id: number;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface LearnerScheduleItem {
  id: number;
  teacher_id: number;
  learner_id: number;
  title: string;
  start_time: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
