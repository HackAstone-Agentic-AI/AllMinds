'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { ForumPost } from '@/types/database';
import { ArrowLeft, MessageSquare, Plus, TriangleAlert as AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function ForumPage() {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '' });
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const loadPosts = useCallback(async () => {
    try {
      const data = await api.getForumPosts();
      setPosts(data);
    } catch (err) {
      console.error('Failed to load posts:', err);
    }
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const createPost = async () => {
    if (!newPost.title.trim() || !newPost.content.trim()) return;

    const bannedWords = ['name', 'address', 'phone', 'email', 'student'];
    const contentLower = (newPost.title + ' ' + newPost.content).toLowerCase();
    if (bannedWords.some((word) => contentLower.includes(word))) {
      setMessage(
        'Your post may contain identifying information. Please remove student names and personal details.'
      );
      return;
    }

    setPosting(true);
    setMessage('');
    try {
      await api.createForumPost({
        title: newPost.title.trim(),
        content: newPost.content.trim(),
      });
      setNewPost({ title: '', content: '' });
      setShowNewPost(false);
      await loadPosts();
      setMessage('Post published successfully.');
    } catch (err: any) {
      setMessage(err.message || 'Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  return (
    <DashboardLayout activeTab="community">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/community')}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-slate-800">Teacher Community Forum</h2>
            <p className="text-slate-600 mt-1">
              Share experiences and connect with fellow educators
            </p>
          </div>
          <button
            onClick={() => setShowNewPost(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Post
          </button>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900 mb-1">Privacy Protection Active</h3>
            <p className="text-sm text-red-800">
              Our system monitors for identifying information. Never share student names,
              addresses, or other personal details. Use anonymous identifiers only.
            </p>
          </div>
        </div>

        {message && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        )}

        {showNewPost && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-xl font-semibold text-slate-800 mb-4">Create New Post</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Title</label>
                <input
                  type="text"
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                  placeholder="What would you like to discuss?"
                  maxLength={150}
                />
                <p className="mt-1 text-xs text-slate-500">{newPost.title.length}/150</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Content</label>
                <textarea
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                  rows={6}
                  placeholder="Share your experience, ask questions, or offer advice..."
                  maxLength={5000}
                />
                <p className="mt-1 text-xs text-slate-500">{newPost.content.length}/5000</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={createPost}
                  disabled={posting || !newPost.title.trim() || !newPost.content.trim()}
                  className="bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {posting ? 'Posting...' : 'Post to Forum'}
                </button>
                <button
                  onClick={() => setShowNewPost(false)}
                  className="px-6 py-3 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-slate-800">Recent Discussions</h3>

          {posts.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <MessageSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-slate-800 mb-2">No posts yet</h4>
              <p className="text-slate-600 mb-4">Be the first to start a discussion</p>
              <button
                onClick={() => setShowNewPost(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create First Post
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-800 text-lg mb-2">{post.title}</h4>
                      <p className="text-slate-600 mb-3 line-clamp-2">{post.content}</p>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span>{new Date(post.created_at).toLocaleDateString()}</span>
                        <span>&bull;</span>
                        <span>{post.author_name || 'Teacher'}</span>
                        <span>&bull;</span>
                        <span>Teacher Community</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
