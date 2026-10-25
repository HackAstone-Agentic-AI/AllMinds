'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import LoadError from '@/components/LoadError';
import {
  BookOpen,
  ExternalLink,
  Flag,
  Loader2,
  LocateFixed,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Sparkles,
  Star,
} from 'lucide-react';
import { api } from '@/lib/api';

interface Ngo {
  id: number;
  name: string;
  city: string | null;
  province: string | null;
  address: string | null;
  services?: string[];
  latitude?: number | null;
  longitude?: number | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  website?: string | null;
  rating?: number | string;
  review_count?: number;
  source_url?: string | null;
  last_checked?: string | null;
  coverage: 'local' | 'national';
  location_precision: 'address' | 'suburb' | 'city' | 'none';
  description?: string | null;
  distanceKm?: number | null;
  score?: number;
  reasons?: string[];
}

interface TrainingResource {
  id: number;
  title: string;
  provider: string;
  topic: string;
  duration: string | null;
  cost: string | null;
  url: string;
  description: string | null;
  last_checked: string | null;
}

interface AiMatch {
  id: number;
  why: string;
}

const PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
  'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape',
];

// South African mobile numbers (06x/07x/08x) can receive WhatsApp messages.
const whatsappLink = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  if (/^0[678]\d{8}$/.test(digits)) return `https://wa.me/27${digits.slice(1)}`;
  return null;
};

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : 'unknown');

function NgoCard({
  ngo,
  aiReason,
  onReviewed,
}: {
  ngo: Ngo;
  aiReason?: string;
  onReviewed: () => void;
}) {
  const [panel, setPanel] = useState<'none' | 'rate' | 'report' | 'map'>('none');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [issue, setIssue] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const hasCoords = ngo.latitude != null && ngo.longitude != null && ngo.location_precision !== 'none';
  const wa = ngo.contact_phone ? whatsappLink(ngo.contact_phone) : null;
  const ratingValue = Number(ngo.rating) || 0;

  const submitReview = async () => {
    if (!rating) return;
    setBusy(true);
    setNotice('');
    try {
      await api.submitNgoReview(ngo.id, rating, comment.trim());
      setNotice('Thanks for your review.');
      setPanel('none');
      onReviewed();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not save your review.');
    } finally {
      setBusy(false);
    }
  };

  const submitReport = async () => {
    if (issue.trim().length < 3) return;
    setBusy(true);
    setNotice('');
    try {
      const res = await api.reportNgo(ngo.id, issue.trim());
      setNotice(res.message || 'Thanks for the report.');
      setIssue('');
      setPanel('none');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not send the report.');
    } finally {
      setBusy(false);
    }
  };

  const delta = 0.02;
  const mapSrc = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${Number(ngo.longitude) - delta}%2C${Number(ngo.latitude) - delta}%2C${Number(ngo.longitude) + delta}%2C${Number(ngo.latitude) + delta}&layer=mapnik&marker=${ngo.latitude}%2C${ngo.longitude}`
    : '';

  return (
    <article className={`rounded-xl border p-5 ${aiReason ? 'border-violet-300 bg-violet-50/40' : 'border-slate-200 bg-white'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-slate-800">{ngo.name}</h4>
          <p className="text-sm text-slate-500">
            {ngo.coverage === 'national' ? 'National service' : [ngo.city, ngo.province].filter(Boolean).join(', ')}
          </p>
        </div>
        <div className="text-right text-sm">
          {ngo.distanceKm != null && ngo.coverage !== 'national' && (
            <p className="font-semibold text-blue-700">{ngo.distanceKm.toFixed(1)} km</p>
          )}
          <p className="flex items-center justify-end gap-1 text-slate-600">
            <Star className="h-4 w-4 text-amber-500" />
            {Number(ngo.review_count) > 0 ? `${ratingValue.toFixed(1)} (${ngo.review_count})` : 'No reviews yet'}
          </p>
        </div>
      </div>

      {aiReason && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-violet-100 px-3 py-2 text-sm text-violet-900">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" /> {aiReason}
        </p>
      )}
      {ngo.description && <p className="mt-3 text-sm text-slate-700">{ngo.description}</p>}
      {(ngo.reasons ?? []).length > 0 && !aiReason && (
        <p className="mt-2 text-xs text-slate-500">Why it ranks here: {ngo.reasons?.join(' · ')}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {(ngo.services ?? []).map((service) => (
          <span key={service} className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700">
            {service}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {ngo.contact_phone && (
          <a href={`tel:${ngo.contact_phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50">
            <Phone className="h-4 w-4" /> {ngo.contact_phone}
          </a>
        )}
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-green-300 px-3 py-1.5 text-green-700 hover:bg-green-50">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        )}
        {ngo.contact_email && (
          <a href={`mailto:${ngo.contact_email}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50">
            <Mail className="h-4 w-4" /> E-mail
          </a>
        )}
        {ngo.website && (
          <a href={ngo.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50">
            <ExternalLink className="h-4 w-4" /> Website
          </a>
        )}
        {hasCoords && (
          <>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ngo.address || `${ngo.latitude},${ngo.longitude}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
            >
              <MapPin className="h-4 w-4" /> Directions
            </a>
            <button type="button" onClick={() => setPanel(panel === 'map' ? 'none' : 'map')} className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50">
              {panel === 'map' ? 'Hide map' : 'Show map'}
            </button>
          </>
        )}
        <button type="button" onClick={() => setPanel(panel === 'rate' ? 'none' : 'rate')} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50">
          <Star className="h-4 w-4" /> Rate
        </button>
        <button type="button" onClick={() => setPanel(panel === 'report' ? 'none' : 'report')} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-50">
          <Flag className="h-4 w-4" /> Report wrong info
        </button>
      </div>

      {panel === 'map' && hasCoords && (
        <div className="mt-3">
          <iframe title={`Map of ${ngo.name}`} src={mapSrc} className="h-56 w-full rounded-lg border border-slate-200" loading="lazy" />
          {ngo.location_precision !== 'address' && (
            <p className="mt-1 text-xs text-slate-500">Approximate location ({ngo.location_precision} level). Confirm the address before visiting.</p>
          )}
        </div>
      )}

      {panel === 'rate' && (
        <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} star${value > 1 ? 's' : ''}`}
                onClick={() => setRating(value)}
              >
                <Star className={`h-6 w-6 ${value <= rating ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`} />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Optional: how did this organisation help? (no learner names)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button type="button" disabled={!rating || busy} onClick={submitReview} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            Submit review
          </button>
        </div>
      )}

      {panel === 'report' && (
        <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
          <textarea
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="What is wrong or out of date?"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button type="button" disabled={issue.trim().length < 3 || busy} onClick={submitReport} className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            Send report
          </button>
        </div>
      )}

      {notice && <p role="status" className="mt-2 text-sm text-slate-700">{notice}</p>}

      <p className="mt-3 text-xs text-slate-400">
        Source:{' '}
        {ngo.source_url ? (
          <a href={ngo.source_url} target="_blank" rel="noopener noreferrer" className="underline">
            public listing
          </a>
        ) : (
          'directory'
        )}{' '}
        · checked {formatDate(ngo.last_checked)} · please confirm details before relying on them
      </p>
    </article>
  );
}

export default function ProfessionalDevelopmentPage() {
  const [activeTab, setActiveTab] = useState<'support' | 'training'>('support');
  const [need, setNeed] = useState('');
  const [province, setProvince] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState('');
  const [results, setResults] = useState<Ngo[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [aiMatches, setAiMatches] = useState<AiMatch[]>([]);
  const [aiNote, setAiNote] = useState('');
  const [matching, setMatching] = useState(false);
  const [training, setTraining] = useState<TrainingResource[]>([]);
  const [trainingError, setTrainingError] = useState('');

  // keepAi: refresh ratings after a review without discarding the AI recommendations.
  const search = useCallback(async (keepAi = false) => {
    setSearching(true);
    setLoadError('');
    if (!keepAi) {
      setAiMatches([]);
      setAiNote('');
    }
    try {
      const params: Record<string, string> = {};
      if (need.trim()) params.need = need.trim();
      if (province) params.province = province;
      if (coords) {
        params.lat = String(coords.lat);
        params.lng = String(coords.lng);
      }
      const data = await api.getNGOs(params);
      setResults(data.ngos || []);
      setSearched(true);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSearching(false);
    }
  }, [need, province, coords]);

  const loadTraining = useCallback(async () => {
    setTrainingError('');
    try {
      setTraining(await api.getTrainingResources());
    } catch (err) {
      setTrainingError(err instanceof Error ? err.message : 'Please try again.');
    }
  }, []);

  useEffect(() => {
    void search();
    // Initial load only; later searches are user-triggered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'training' && training.length === 0) void loadTraining();
  }, [activeTab, training.length, loadTraining]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationNote('Location is not supported in this browser. Choose a province instead.');
      return;
    }
    setLocating(true);
    setLocationNote('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationNote('Using your current location for distances.');
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        setLocationNote(`${error.message || 'Location was not shared'}. You can still search by province.`);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  useEffect(() => {
    if (coords) void search();
    // Re-rank as soon as a location becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords]);

  const askAi = async () => {
    if (!need.trim() || results.length === 0) return;
    setMatching(true);
    setAiNote('');
    try {
      const candidates = results.slice(0, 10).map((ngo) => ({
        id: ngo.id,
        name: ngo.name,
        services: ngo.services,
        description: ngo.description,
        city: ngo.city,
        province: ngo.province,
        coverage: ngo.coverage,
        distanceKm: ngo.distanceKm != null ? Number(ngo.distanceKm.toFixed(1)) : null,
        reasons: ngo.reasons,
      }));
      const res = await api.chatWithAgent(need.trim(), {
        tool_hint: 'ngo',
        request_context: { candidates },
        language_pref: localStorage.getItem('allminds_language') || 'en',
      });
      setAiMatches(Array.isArray(res.matches) ? res.matches : []);
      setAiNote(res.response || '');
    } catch (err) {
      setAiNote(err instanceof Error ? err.message : 'AI matching failed.');
    } finally {
      setMatching(false);
    }
  };

  const matchedIds = new Set(aiMatches.map((m) => m.id));
  const aiPicks = aiMatches
    .map((m) => ({ match: m, ngo: results.find((n) => n.id === m.id) }))
    .filter((x): x is { match: AiMatch; ngo: Ngo } => Boolean(x.ngo));

  return (
    <DashboardLayout activeTab="professional-development">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Support &amp; Professional Development</h2>
          <p className="mt-1 text-slate-600">Find support organisations for your learners and courses for yourself.</p>
        </div>

        <div className="flex gap-2 border-b border-slate-200" role="tablist">
          {([
            ['support', 'Support Organisations', MapPin],
            ['training', 'Training', BookOpen],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={`border-b-2 px-6 py-3 font-medium transition ${
                activeTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon className="h-5 w-5" /> {label}
              </span>
            </button>
          ))}
        </div>

        {activeTab === 'support' && (
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_auto]">
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-700">What does the learner need?</span>
                  <input
                    value={need}
                    onChange={(e) => setNeed(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void search()}
                    placeholder="e.g. autism diagnosis, speech therapy, dyslexia support"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Province</span>
                  <select value={province} onChange={(e) => setProvince(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                    <option value="">All provinces</option>
                    {PROVINCES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end gap-2">
                  <button type="button" onClick={() => void search()} disabled={searching} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <button type="button" onClick={useMyLocation} disabled={locating} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50">
                  <LocateFixed className="h-4 w-4" /> {locating ? 'Locating…' : coords ? 'Location on' : 'Use my location (optional)'}
                </button>
                <button
                  type="button"
                  onClick={askAi}
                  disabled={!need.trim() || results.length === 0 || matching}
                  className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-1.5 font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                  title={!need.trim() ? 'Describe the need first' : undefined}
                >
                  {matching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Ask AI for the best match
                </button>
                {locationNote && <span className="text-slate-500">{locationNote}</span>}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Ranking: 50% distance, 30% match to the need, 20% teacher rating. Without a location, nearby organisations
                are ranked by need and rating. Listings come from public directories; confirm details before relying on them.
              </p>
            </div>

            <LoadError message={loadError} onRetry={() => void search()} />

            {(aiPicks.length > 0 || aiNote) && (
              <section className="space-y-3">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-violet-800">
                  <Sparkles className="h-5 w-5" /> AI recommendations
                </h3>
                {aiNote && <p className="text-sm text-slate-600">{aiNote}</p>}
                {aiPicks.map(({ match, ngo }) => (
                  <NgoCard key={`ai-${ngo.id}`} ngo={ngo} aiReason={match.why} onReviewed={() => void search(true)} />
                ))}
              </section>
            )}

            <section className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-800">
                {searched ? `${results.length} organisation${results.length === 1 ? '' : 's'}` : 'Organisations'}
              </h3>
              {searched && results.length === 0 && !loadError && (
                <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  No organisations match yet. Try another province or a broader need such as &quot;autism&quot; or &quot;therapy&quot;.
                </p>
              )}
              {results
                .filter((ngo) => !matchedIds.has(ngo.id))
                .map((ngo) => (
                  <NgoCard key={ngo.id} ngo={ngo} onReviewed={() => void search(true)} />
                ))}
            </section>
          </div>
        )}

        {activeTab === 'training' && (
          <div className="space-y-4">
            <LoadError message={trainingError} onRetry={() => void loadTraining()} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {training.map((resource) => (
                <article key={resource.id} className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-blue-600">{resource.topic}</p>
                  <h4 className="mt-1 text-lg font-semibold text-slate-800">{resource.title}</h4>
                  <p className="text-sm text-slate-500">{resource.provider}</p>
                  {resource.description && <p className="mt-2 text-sm text-slate-700">{resource.description}</p>}
                  <p className="mt-2 text-xs text-slate-500">
                    {[resource.duration, resource.cost].filter(Boolean).join(' · ')} · link checked {formatDate(resource.last_checked)}
                  </p>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Open <ExternalLink className="h-4 w-4" />
                  </a>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
