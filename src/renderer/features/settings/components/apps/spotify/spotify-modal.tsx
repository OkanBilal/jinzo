import { useState, useEffect } from "react";

import { Close } from "../../../../../components/ui/icons";
import Text, {
  Body,
  Muted,
  ErrorText,
  Caption,
  BodyMedium,
} from "../../../../../components/ui/text";
import {
  SecondaryButton,
  WarningButton,
  DangerButton,
  PrimaryButton,
  LinkButton,
} from "../../../../../components/ui/button";

type SpotifyModalProps = {
  open: boolean;
  onClose: () => void;
  isConnected: boolean;
};

type Step = "setToken" | "add" | "manage";

const SpotifyModal = ({ open, onClose, isConnected }: SpotifyModalProps) => {
  const [step, setStep] = useState<Step>("setToken");
  const [accessToken, setAccessToken] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [existingSources, setExistingSources] = useState<any[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [initializing, setInitializing] = useState(false);

  useEffect(() => {
    if (open) {
      setInitializing(true);
      if (isConnected) {
        const startTime = Date.now();
        loadSelectedSources().finally(() => {
          const elapsed = Date.now() - startTime;
          const minLoadingTime = 600;
          const remainingTime = Math.max(0, minLoadingTime - elapsed);

          setTimeout(() => {
            setInitializing(false);
          }, remainingTime);
        });
      } else {
        setStep("setToken");
        setInitializing(false);
      }
    } else {
      setAccessToken("");
      setSelectedSources([]);
      setExistingSources([]);
      setConnectionId("");
      setError("");
    }
  }, [open, isConnected]);

  const loadSelectedSources = async () => {
    try {
      const connRes = await fetch("/api/connections?provider=spotify");
      if (connRes.ok) {
        const connData = await connRes.json();
        if (connData.success) {
          setConnectionId(connData.connection.id);
        }
      }

      const res = await fetch("/api/connections/selected?provider=spotify");
      if (res.ok) {
        const data = await res.json();
        setExistingSources(data.sources || []);
        setStep("manage");
      }
    } catch (error) {
      console.error("Error fetching sources:", error);
    }
  };

  const handleSaveCredentials = async () => {
    if (!accessToken.trim()) {
      setError("Access token is required");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const connResponse = await fetch("/api/connections?provider=spotify");
      const connData = await connResponse.json();

      if (!connData.success) {
        throw new Error("Failed to get connection");
      }

      const connId = connData.connection.id;
      setConnectionId(connId);

      const res = await fetch("/api/connections/credentials", { //TODO: update to ipc
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "spotify",
          connectionId: connId,
          accessToken,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save credentials");
      }

      setStep("add");
    } catch (error: any) {
      setError(error.message || "Failed to save credentials");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSources = async () => {
    if (selectedSources.length === 0) {
      setError("Please select at least one source");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/connections/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "spotify",
          connectionId,
          resources: selectedSources,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save sources");
      }

      onClose();
    } catch (error: any) {
      setError(error.message || "Failed to save sources");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveSource = async (sourceId: string) => {
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/connections/resources/${sourceId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to remove source");
      }

      loadSelectedSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove source");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!confirm("Are you sure you want to disconnect Spotify?")) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/connections/revoke", {
        method: "DELETE",
        body: JSON.stringify({ provider: "spotify" }),
      });

      if (!res.ok) {
        throw new Error("Failed to revoke connection");
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSource = (source: string) => {
    setSelectedSources((prev) =>
      prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source]
    );
  };

  const handleAddMore = async () => {
    setIsLoading(true);
    setError("");

    try {
      const currentSourceIds = new Set(
        existingSources.map((s: any) => s.source)
      );

      setSelectedSources(Array.from(currentSourceIds));

      setStep("add");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sources");
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-50 w-full max-w-2xl bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-900 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-primary-200 dark:border-primary-900">
          <div className="flex items-center gap-2">
            <img
              src="/apps/spotify-skeuomorphic.png"
              alt="Spotify"
              className="w-10 h-10"
              width={256}
              height={256}
            />
            <Text variant="h3">Spotify Connection</Text>
          </div>
          <button
            onClick={onClose}
            className="p-2 flex cursor-pointer items-center justify-center rounded-lg text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors"
          >
            <Close className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 min-h-75">
          <div className="transition-opacity duration-200">
            {initializing ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-3">
                  <div className="w-8 h-8 border-2 border-primary-300 dark:border-primary-700 border-t-primary-900 dark:border-t-primary-100 rounded-full animate-spin mx-auto" />
                  <Muted>Loading sources...</Muted>
                </div>
              </div>
            ) : step === "setToken" ? (
              <CredentialsStep
                accessToken={accessToken}
                setAccessToken={setAccessToken}
                isLoading={isLoading}
                error={error}
                onNext={handleSaveCredentials}
              />
            ) : step === "add" ? (
              <SourcesStep
                selectedSources={selectedSources}
                toggleSource={toggleSource}
                isLoading={isLoading}
                error={error}
                onFinish={handleSaveSources}
                existingSources={existingSources}
              />
            ) : (
              <ManageStep
                existingSources={existingSources}
                onRemove={handleRemoveSource}
                onRevoke={handleRevoke}
                onAddMore={handleAddMore}
                loading={isLoading}
                error={error}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const CredentialsStep = ({
  accessToken,
  setAccessToken,
  isLoading,
  error,
  onNext,
}: any) => (
  <div className="space-y-4">
    <Muted>
      Enter your Spotify access token to connect your music library.
    </Muted>

    <div>
      <label htmlFor="access-token" className="block mb-2">
        <Text variant="label">Access Token</Text>
      </label>
      <input
        id="access-token"
        type="password"
        value={accessToken}
        onChange={(e) => setAccessToken(e.target.value)}
        placeholder="BQD4ZoGLWj8..."
        className="w-full px-3 py-2.5 bg-white dark:bg-primary-100 rounded-xl text-primary-900 dark:text-primary-900 placeholder:text-primary-400 dark:placeholder:text-primary-600 focus:outline-none"
        disabled={isLoading}
        onKeyDown={(e) => {
          if (e.key === "Enter") onNext();
        }}
      />
    </div>

    {error && <ErrorText>{error}</ErrorText>}

    <div className="flex justify-end gap-3 pt-2">
      <PrimaryButton
        onClick={onNext}
        disabled={isLoading || !accessToken.trim()}
        isLoading={isLoading}
      >
        {isLoading ? "Connecting..." : "Continue"}
      </PrimaryButton>
    </div>

    <div className="mt-4 p-4 bg-primary-100 dark:bg-primary-800 rounded-xl">
      <Caption>
        <strong>How to get your access token:</strong>
        <br />
        1. Go to{" "}
        <a
          href="https://developer.spotify.com/console/get-current-user/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Spotify Developer Console
        </a>
        <br />
        2. Click &quot;Get Token&quot; and authorize the required scopes
        <br />
        3. Copy the OAuth Token and paste it here
        <br />
        <br />
        <strong>Required scopes:</strong>
        user-library-read, user-read-recently-played, user-top-read,
        playlist-read-private
      </Caption>
    </div>
  </div>
);

const SourcesStep = ({
  selectedSources,
  toggleSource,
  isLoading,
  error,
  onFinish,
  existingSources = [],
}: any) => {
  const allSources = [
    {
      id: "playlists",
      name: "Your Playlists",
      description: "Your saved and created playlists",
    },
    {
      id: "recently-played",
      name: "Recently Played",
      description: "Tracks you've recently listened to",
    },
    {
      id: "top-tracks",
      name: "Top Tracks",
      description: "Your most played tracks",
    },
    {
      id: "top-artists",
      name: "Top Artists",
      description: "Your most listened artists",
    },
    {
      id: "saved-albums",
      name: "Saved Albums",
      description: "Albums in your library",
    },
  ];

  const existingSourceIds = new Set(existingSources.map((s: any) => s.source));
  const availableSources = allSources.filter(
    (source) => !existingSourceIds.has(source.id)
  );

  return (
    <div className="space-y-4">
      <Muted>
        Select which Spotify content you want to include in your feed.{" "}
        {selectedSources.length} selected.
      </Muted>

      <div className="max-h-64 overflow-y-auto border border-primary-200 dark:border-primary-900 rounded-xl">
        {availableSources.length === 0 ? (
          <div className="p-8 text-center text-primary-500 dark:text-primary-400">
            <Body>All sources are already connected.</Body>
          </div>
        ) : (
          availableSources.map((source) => {
            const isSelected = selectedSources.includes(source.id);
            return (
              <div
                key={source.id}
                className="flex items-center justify-between px-4 py-4 border-b border-primary-200 dark:border-primary-900 last:border-b-0"
              >
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => toggleSource(source.id)}
                >
                  <BodyMedium>{source.name}</BodyMedium>
                  <Caption className="mt-0.5">{source.description}</Caption>
                </div>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleSource(source.id);
                  }}
                  disabled={isLoading}
                  className="w-4 h-4 text-primary-600 dark:text-primary-400 rounded cursor-pointer"
                />
              </div>
            );
          })
        )}
      </div>

      {error && <ErrorText>{error}</ErrorText>}

      <div className="flex justify-end gap-3 pt-2">
        <PrimaryButton
          onClick={onFinish}
          disabled={isLoading || selectedSources.length === 0}
          isLoading={isLoading}
        >
          {isLoading ? "Saving..." : `Save ${selectedSources.length} Sources`}
        </PrimaryButton>
      </div>
    </div>
  );
};

const ManageStep = ({
  existingSources,
  onRemove,
  onRevoke,
  onAddMore,
  loading,
  error,
}: any) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <Muted>
        {existingSources.length}{" "}
        {existingSources.length === 1 ? "source" : "sources"} connected
      </Muted>
      <SecondaryButton onClick={onAddMore} disabled={loading} size="sm">
        Add Sources
      </SecondaryButton>
    </div>

    <div className="max-h-64 overflow-y-auto border border-primary-200 dark:border-primary-900 rounded-xl">
      {existingSources.length === 0 ? (
        <div className="p-8 text-center text-primary-500 dark:text-primary-400">
          <Body>No sources connected yet.</Body>
          <LinkButton onClick={onAddMore} disabled={loading} className="mt-3">
            Add sources
          </LinkButton>
        </div>
      ) : (
        existingSources.map((source: any) => (
          <div
            key={source.id}
            className="flex items-center justify-between px-4 py-3 border-b border-primary-200 dark:border-primary-900 last:border-b-0"
          >
            <div className="flex-1">
              <BodyMedium>{source.name}</BodyMedium>
              <Caption className="mt-0.5">{source.source}</Caption>
            </div>
            <WarningButton
              onClick={() => onRemove(source.id)}
              disabled={loading}
              size="xs"
            >
              Remove
            </WarningButton>
          </div>
        ))
      )}
    </div>

    {error && <ErrorText>{error}</ErrorText>}

    <div className="flex justify-end">
      <DangerButton onClick={onRevoke} disabled={loading}>
        Revoke Spotify Access
      </DangerButton>
    </div>
  </div>
);

export default SpotifyModal;
