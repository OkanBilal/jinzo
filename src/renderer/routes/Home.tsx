import React, { useEffect, useState } from "react";

interface FeedItem {
  id: number;
  title: string;
  url: string;
  description: string | null;
  itemType: string | null;
  date: Date;
  source: string;
  imageUrl: string | null;
  createdAt: Date;
}

interface DatabaseStats {
  feedItems: number;
  chatSessions: number;
  connections: number;
}

interface DatabaseResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export default function Home() {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load feed items
      const feedResult = await window.api.database.getFeedItems(20) as DatabaseResponse<FeedItem[]>;
      console.log("Feed items result:", feedResult);
      if (feedResult.success && feedResult.data) {
        setFeedItems(feedResult.data);
      } else {
        throw new Error(feedResult.error || "Failed to load feed items");
      }

      // Load stats
      const statsResult = await window.api.database.getStats() as DatabaseResponse<DatabaseStats>;
      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      } else {
        console.warn("Failed to load stats:", statsResult.error);
      }
    } catch (err) {
      console.error("Error loading data:", err);
      setError(err instanceof Error ? err.message : "Veri yüklenirken hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center text-red-600">
          <p className="text-xl font-semibold mb-2">Hata</p>
          <p>{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Jinzo</h1>
          <p className="text-gray-600">Electron + Drizzle ORM Database Uygulaması</p>
        </header>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Feed Items</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.feedItems}</p>
                </div>
                <div className="bg-blue-100 rounded-full p-3">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Chat Sessions</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.chatSessions}</p>
                </div>
                <div className="bg-green-100 rounded-full p-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Connections</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.connections}</p>
                </div>
                <div className="bg-purple-100 rounded-full p-3">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feed Items List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Son Feed Öğeleri</h2>
          </div>
          
          {feedItems.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              <p>Henüz feed öğesi yok</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {feedItems.map((item) => (
                <div key={item.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start space-x-4">
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-16 h-16 rounded object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-medium text-gray-900 mb-1">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-600"
                        >
                          {item.title}
                        </a>
                      </h3>
                      {item.description && (
                        <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span className="px-2 py-1 bg-gray-100 rounded">{item.source}</span>
                        {item.itemType && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            {item.itemType}
                          </span>
                        )}
                        <span>{new Date(item.date).toLocaleDateString("tr-TR")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
