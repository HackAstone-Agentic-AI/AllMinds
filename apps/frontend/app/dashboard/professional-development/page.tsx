'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { BookOpen, MapPin, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';

interface NearbyNgo {
  id: number;
  name: string;
  city: string;
  province: string;
  services?: string[];
  latitude?: number;
  longitude?: number;
  contact_phone?: string;
  distanceKm?: number;
}

export default function ProfessionalDevelopmentPage() {
  const [activeTab, setActiveTab] = useState<'training' | 'health'>('training');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [nearbyServices, setNearbyServices] = useState<NearbyNgo[]>([]);
  const [serviceFilter, setServiceFilter] = useState('');

  const trainingResources = [
    {
      title: 'Understanding Autism Spectrum Disorder',
      provider: 'Coursera',
      duration: '4 weeks',
      level: 'Beginner',
      url: 'https://www.coursera.org',
      description: 'Learn about ASD characteristics and effective teaching strategies',
    },
    {
      title: 'ADHD in the Classroom',
      provider: 'edX',
      duration: '6 weeks',
      level: 'Intermediate',
      url: 'https://www.edx.org',
      description: 'Strategies for supporting students with ADHD',
    },
    {
      title: 'Inclusive Education Practices',
      provider: 'FutureLearn',
      duration: '3 weeks',
      level: 'Beginner',
      url: 'https://www.futurelearn.com',
      description: 'Creating inclusive learning environments for all students',
    },
    {
      title: 'Sensory Processing in Education',
      provider: 'Udemy',
      duration: 'Self-paced',
      level: 'Intermediate',
      url: 'https://www.udemy.com',
      description: 'Understanding sensory needs in neurodiverse learners',
    },
    {
      title: 'Teacher Stress Management',
      provider: 'LinkedIn Learning',
      duration: '2 hours',
      level: 'All Levels',
      url: 'https://www.linkedin.com/learning',
      description: 'Techniques for managing stress and preventing burnout',
    },
    {
      title: 'Dyslexia Support Strategies',
      provider: 'Coursera',
      duration: '5 weeks',
      level: 'Intermediate',
      url: 'https://www.coursera.org',
      description: 'Evidence-based approaches for supporting students with dyslexia',
    },
  ];

  const calculateDistanceKm = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  };

  const enableLocationServices = async () => {
    if (!navigator.geolocation) {
      setLocationError('Location services are not supported in this browser.');
      return;
    }

    setLocationLoading(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const data = await api.getNGOs();
          const nearest = (data.ngos || [])
            .filter((ngo: NearbyNgo) => ngo.latitude && ngo.longitude)
            .map((ngo: NearbyNgo) => ({
              ...ngo,
              distanceKm: calculateDistanceKm(
                position.coords.latitude,
                position.coords.longitude,
                Number(ngo.latitude),
                Number(ngo.longitude),
              ),
            }))
            .sort((a: NearbyNgo, b: NearbyNgo) => (a.distanceKm || 0) - (b.distanceKm || 0))
            .slice(0, 6);

          setNearbyServices(nearest);

          if (nearest.length === 0) {
            setLocationError(
              'Location permission worked, but no nearby services with map coordinates are available yet.',
            );
          }
        } catch (error) {
          console.error('Failed to load nearby services:', error);
          setLocationError('We could not load nearby services right now.');
        } finally {
          setLocationLoading(false);
        }
      },
      (error) => {
        setLocationLoading(false);
        setLocationError(error.message || 'Unable to access your location.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  };

  const filteredNearbyServices = nearbyServices.filter((ngo) => {
    if (!serviceFilter) {
      return true;
    }

    return (ngo.services || []).some((service) =>
      service.toLowerCase().includes(serviceFilter.toLowerCase()),
    );
  });

  return (
    <DashboardLayout activeTab="professional-development">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Professional Development</h2>
          <p className="text-slate-600 mt-1">
            Resources to support your growth as an educator
          </p>
        </div>

        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('training')}
            className={`px-6 py-3 font-medium transition border-b-2 ${
              activeTab === 'training'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Training Materials
            </div>
          </button>
          <button
            onClick={() => setActiveTab('health')}
            className={`px-6 py-3 font-medium transition border-b-2 ${
              activeTab === 'health'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Health Facilities
            </div>
          </button>
        </div>

        {activeTab === 'training' && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-2">Curated Learning Resources</h3>
              <p className="text-sm text-blue-800">
                Access high-quality courses and training materials specifically selected for
                teachers working with neurodiverse learners. These resources cover autism, ADHD,
                dyslexia, sensory processing, and teacher wellbeing.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trainingResources.map((resource, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-6 h-6 text-blue-600" />
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        resource.level === 'Beginner'
                          ? 'bg-green-100 text-green-700'
                          : resource.level === 'Intermediate'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {resource.level}
                    </span>
                  </div>

                  <h4 className="font-semibold text-slate-800 mb-2">{resource.title}</h4>
                  <p className="text-sm text-slate-600 mb-3">{resource.description}</p>

                  <div className="flex items-center justify-between text-sm text-slate-500 mb-4">
                    <span>{resource.provider}</span>
                    <span>{resource.duration}</span>
                  </div>

                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    Access Course
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'health' && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="font-semibold text-green-900 mb-2">Find Nearby Support</h3>
              <p className="text-sm text-green-800">
                Locate health facilities and support services near you to ensure learners receive
                the care they need when additional professional support is required.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="text-center py-12">
                <MapPin className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-slate-800 mb-2">
                  Location-Based Services
                </h4>
                <p className="text-slate-600 mb-6 max-w-md mx-auto">
                  This feature will show nearby health facilities, pediatricians, child
                  psychologists, and special education support services based on your location.
                </p>
                <button
                  onClick={enableLocationServices}
                  disabled={locationLoading}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <MapPin className="w-5 h-5" />
                  {locationLoading ? 'Locating Nearby Services...' : 'Enable Location Services'}
                </button>
              </div>

              <div className="border-t border-slate-200 mt-6 pt-6">
                {locationError && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    {locationError}
                  </div>
                )}

                {nearbyServices.length > 0 && (
                  <div className="mb-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                      <h4 className="font-semibold text-slate-800">Nearest Support Services</h4>
                      <input
                        type="text"
                        value={serviceFilter}
                        onChange={(event) => setServiceFilter(event.target.value)}
                        className="w-full md:w-72 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                        placeholder="Filter by service"
                      />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
                      <div className="space-y-4">
                        {filteredNearbyServices.map((ngo) => (
                          <div key={ngo.id} className="p-4 bg-slate-50 rounded-lg">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h5 className="font-medium text-slate-800">{ngo.name}</h5>
                                <p className="text-sm text-slate-600">
                                  {ngo.city}, {ngo.province}
                                </p>
                              </div>
                              <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
                                {(ngo.distanceKm || 0).toFixed(1)} km
                              </span>
                            </div>
                            {ngo.services && ngo.services.length > 0 && (
                              <p className="text-sm text-slate-600 mt-2">
                                {ngo.services.slice(0, 4).join(', ')}
                              </p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {ngo.contact_phone && (
                                <span className="text-sm text-slate-500">{ngo.contact_phone}</span>
                              )}
                              {ngo.latitude && ngo.longitude && (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${ngo.latitude},${ngo.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-green-700 hover:text-green-800 font-medium"
                                >
                                  Open in Maps
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-green-50 to-white p-4">
                        <h5 className="font-semibold text-slate-800 mb-3">Service Map Snapshot</h5>
                        <div className="space-y-3">
                          {filteredNearbyServices.slice(0, 5).map((ngo, index) => (
                            <div
                              key={ngo.id}
                              className="flex items-center justify-between rounded-lg bg-white px-3 py-3 border border-slate-200"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-semibold">
                                  {index + 1}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-800">{ngo.name}</p>
                                  <p className="text-xs text-slate-500">
                                    {ngo.city}, {ngo.province}
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs text-slate-500">
                                {(ngo.distanceKm || 0).toFixed(1)} km
                              </span>
                            </div>
                          ))}
                          {filteredNearbyServices.length === 0 && (
                            <p className="text-sm text-slate-500">
                              No nearby services match that filter yet.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <h4 className="font-semibold text-slate-800 mb-4">Common Support Services</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h5 className="font-medium text-slate-800 mb-2">
                      Child Psychologists
                    </h5>
                    <p className="text-sm text-slate-600">
                      Specialists in child development and behavioral support
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h5 className="font-medium text-slate-800 mb-2">
                      Occupational Therapists
                    </h5>
                    <p className="text-sm text-slate-600">
                      Support for sensory and motor skill development
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h5 className="font-medium text-slate-800 mb-2">Speech Therapists</h5>
                    <p className="text-sm text-slate-600">
                      Communication and language development specialists
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h5 className="font-medium text-slate-800 mb-2">
                      Special Education Consultants
                    </h5>
                    <p className="text-sm text-slate-600">
                      Expert guidance on inclusive education strategies
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
