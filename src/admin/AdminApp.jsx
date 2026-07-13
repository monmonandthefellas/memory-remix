import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AdminApiError,
  getSubmissionById,
  listSubmissions,
  updateSubmissionStatus,
} from "./apiClient";

const STATUS_LABELS = {
  all: "All",
  approved: "Approved",
  rejected: "Rejected",
  pending: "Pending",
};

const FILTER_OPTIONS = ["all", "pending", "approved", "rejected"];
const PAGE_SIZE_OPTIONS = [25, 50, 100];

function toUserError(error) {
  if (!(error instanceof AdminApiError)) {
    return "Unexpected error. Please try again.";
  }

  if (error.code === "unauthorized") {
    return "Session expired. Please sign in again.";
  }

  if (error.code === "forbidden") {
    return "Your account does not have admin access.";
  }

  if (typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }

  return "Admin API request failed.";
}

function formatAudioTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function PlayIcon() {
  return (
    <svg className="admin-audio-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5v14l11-7z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="admin-audio-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="13" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg className="admin-audio-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      <path
        d="M16 8.5a4.5 4.5 0 0 1 0 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M18.5 6a8 8 0 0 1 0 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg className="admin-audio-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      <path
        d="M16 9l5 6M21 9l-5 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AudioPlayer({ src }) {
  const audioRef = useRef(null);
  const previousVolumeRef = useRef(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    audio.preload = "auto";
    audio.load();

    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setVolume(1);
    setIsMuted(false);
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const handleDurationChange = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleVolumeChange = () => {
      setVolume(audio.volume);
      setIsMuted(audio.muted || audio.volume === 0);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("volumechange", handleVolumeChange);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("volumechange", handleVolumeChange);
    };
  }, [src]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
      return;
    }

    audio.pause();
  };

  const handleSeek = (event) => {
    const audio = audioRef.current;
    if (!audio) return;

    const nextTime = Number(event.target.value);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const adjustVolume = (delta) => {
    const audio = audioRef.current;
    if (!audio) return;

    const nextVolume = Math.max(0, Math.min(1, audio.volume + delta));
    audio.muted = false;
    audio.volume = nextVolume;
    previousVolumeRef.current = nextVolume > 0 ? nextVolume : previousVolumeRef.current;
  };

  const handleVolumeSliderChange = (event) => {
    const audio = audioRef.current;
    if (!audio) return;

    const nextVolume = Number(event.target.value);
    audio.volume = nextVolume;
    audio.muted = nextVolume === 0;

    if (nextVolume > 0) {
      previousVolumeRef.current = nextVolume;
    }
  };

  const handleMuteToggle = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.muted || audio.volume === 0) {
      audio.muted = false;
      audio.volume = previousVolumeRef.current > 0 ? previousVolumeRef.current : 1;
      return;
    }

    previousVolumeRef.current = audio.volume > 0 ? audio.volume : previousVolumeRef.current;
    audio.muted = true;
  };

  const safeDuration = duration > 0 ? duration : 0;
  const safeCurrent = Math.min(currentTime, safeDuration || 0);

  return (
    <div className="admin-audio-player-wrap">
      <audio ref={audioRef} src={src} preload="auto" />
      <div className="admin-audio-player-panel">
        <input
          className="admin-audio-progress"
          type="range"
          min={0}
          max={safeDuration || 1}
          step={0.1}
          value={safeCurrent}
          onChange={handleSeek}
          aria-label="Seek audio position"
        />

        <div className="admin-audio-reference-row">
          <button
            type="button"
            className="admin-audio-circle-btn"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause audio" : "Play audio"}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <div
            className="admin-volume-control"
            onWheel={(event) => {
              event.preventDefault();
              adjustVolume(event.deltaY < 0 ? 0.05 : -0.05);
            }}
          >
            <button
              type="button"
              className="admin-audio-circle-btn"
              onClick={handleMuteToggle}
              aria-label={isMuted ? "Unmute audio" : "Mute audio"}
              title={`Volume ${Math.round(volume * 100)}% (mouse wheel to adjust)`}
            >
              {isMuted ? <MuteIcon /> : <VolumeIcon />}
            </button>
            <input
              className="admin-audio-volume-popover"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeSliderChange}
              aria-label="Adjust volume"
            />
          </div>
          <span className="admin-audio-time-pill">
            {formatAudioTime(safeCurrent)} / {formatAudioTime(safeDuration)}
          </span>
          <div className="admin-audio-spacer" />
        </div>
      </div>
    </div>
  );
}

function AdminApp({ onLogout }) {
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [paginationCount, setPaginationCount] = useState(0);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingSelectedItem, setLoadingSelectedItem] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState("");
  const selectedAudioUrl = selectedItem?.audio_url || "";

  const canPrevPage = offset > 0;
  const canNextPage = offset + rows.length < paginationCount;

  const selectedStatusLabel = useMemo(() => {
    return selectedItem?.status ? STATUS_LABELS[selectedItem.status] || selectedItem.status : "";
  }, [selectedItem]);

  const getStatusClassName = (status) => {
    if (status === "approved") return "admin-badge admin-badge-approved";
    if (status === "rejected") return "admin-badge admin-badge-rejected";
    return "admin-badge admin-badge-pending";
  };

  const loadRows = useCallback(async () => {
    setLoadingList(true);
    setError("");

    try {
      const payload = await listSubmissions({ status: statusFilter, limit, offset });
      const nextRows = Array.isArray(payload?.data) ? payload.data : [];

      setRows(nextRows);
      setPaginationCount(typeof payload?.pagination?.count === "number" ? payload.pagination.count : 0);

      setSelectedItem((prev) => {
        if (!prev) return null;
        return nextRows.find((row) => row.id === prev.id) || prev;
      });
    } catch (apiError) {
      if (apiError instanceof AdminApiError && apiError.code === "unauthorized") {
        await onLogout();
        return;
      }

      setRows([]);
      setPaginationCount(0);
      setError(toUserError(apiError));
    } finally {
      setLoadingList(false);
    }
  }, [limit, offset, onLogout, statusFilter]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedItem(null);
      return;
    }

    let cancelled = false;

    const loadSelectedItem = async () => {
      setLoadingSelectedItem(true);

      try {
        const payload = await getSubmissionById(selectedId);
        if (cancelled) return;

        const latest = payload?.data || null;
        setSelectedItem(latest);

        if (latest) {
          setRows((prev) => prev.map((row) => (row.id === latest.id ? { ...row, ...latest } : row)));
        }
      } catch (apiError) {
        if (cancelled) return;

        if (apiError instanceof AdminApiError && apiError.code === "unauthorized") {
          await onLogout();
          return;
        }

        if (apiError instanceof AdminApiError && apiError.code === "not_found") {
          setSelectedId(null);
          setSelectedItem(null);
          return;
        }

        setError(toUserError(apiError));
      } finally {
        if (!cancelled) {
          setLoadingSelectedItem(false);
        }
      }
    };

    loadSelectedItem();

    return () => {
      cancelled = true;
    };
  }, [onLogout, selectedId]);

  const handleOpenDetails = (row) => {
    setSelectedId(row.id);
    setSelectedItem(row);
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedItem) return;

    const targetId = selectedItem.id;
    const previousRows = rows;
    const previousSelectedItem = selectedItem;

    setUpdatingStatus(true);
    setError("");

    setRows((prev) =>
      prev.map((row) => (row.id === targetId ? { ...row, status: newStatus } : row))
    );
    setSelectedItem((prev) => (prev ? { ...prev, status: newStatus } : prev));

    try {
      const payload = await updateSubmissionStatus(targetId, newStatus);
      const updated = payload?.data || { id: targetId, status: newStatus };

      setRows((prev) => prev.map((row) => (row.id === targetId ? { ...row, ...updated } : row)));
      setSelectedItem((prev) => (prev ? { ...prev, ...updated } : prev));

      await loadRows();

      if (statusFilter !== "all" && updated.status !== statusFilter) {
        setSelectedId(null);
        setSelectedItem(null);
      }
    } catch (apiError) {
      if (apiError instanceof AdminApiError && apiError.code === "unauthorized") {
        await onLogout();
        return;
      }

      setRows(previousRows);
      setSelectedItem(previousSelectedItem);
      setError(toUserError(apiError));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const renderTableBody = () => {
    if (loadingList) {
      return (
        <tr>
          <td className="admin-empty-row" colSpan={4}>
            Loading submissions...
          </td>
        </tr>
      );
    }

    if (!rows.length) {
      return (
        <tr>
          <td className="admin-empty-row" colSpan={4}>
            No submissions found.
          </td>
        </tr>
      );
    }

    return rows.map((row) => {
      const formattedDate = new Date(row.created_at).toLocaleString("en-US", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      return (
        <tr key={row.id} className="admin-row" onClick={() => handleOpenDetails(row)}>
          <td>{row.id}</td>
          <td>{row.name || "-"}</td>
          <td>{formattedDate}</td>
          <td className="admin-table-status">
            <span className={getStatusClassName(row.status)}>
              {STATUS_LABELS[row.status] || row.status}
            </span>
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <h1 className="admin-title">Memory Remix: Applications</h1>
        <button type="button" className="admin-logout-btn" onClick={onLogout}>
          Logout
        </button>
      </header>

      <div className="admin-toolbar">
        <div className="admin-filter-group">
          {FILTER_OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              className={`admin-filter-btn ${statusFilter === status ? "is-active" : ""}`}
              onClick={() => {
                setStatusFilter(status);
                setOffset(0);
              }}
              disabled={loadingList || updatingStatus}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>

        <div className="admin-toolbar-right">
          <label className="admin-limit-label" htmlFor="admin-limit-select">
            Per page
          </label>
          <select
            id="admin-limit-select"
            className="admin-limit-select"
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value));
              setOffset(0);
            }}
            disabled={loadingList || updatingStatus}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!!error && <p className="admin-error-banner">{error}</p>}

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Date</th>
              <th className="admin-table-status">Status</th>
            </tr>
          </thead>
          <tbody>{renderTableBody()}</tbody>
        </table>
      </div>

      <div className="admin-pagination">
        <span className="admin-meta-note">
          Showing {rows.length} of {paginationCount}
        </span>
        <div className="admin-pagination-controls">
          <button
            type="button"
            className="admin-pagination-btn"
            onClick={() => setOffset((prev) => Math.max(prev - limit, 0))}
            disabled={!canPrevPage || loadingList || updatingStatus}
          >
            Previous
          </button>
          <button
            type="button"
            className="admin-pagination-btn"
            onClick={() => setOffset((prev) => prev + limit)}
            disabled={!canNextPage || loadingList || updatingStatus}
          >
            Next
          </button>
        </div>
      </div>

      {selectedItem && (
        <div
          className="admin-modal-backdrop"
          onClick={() => {
            setSelectedId(null);
            setSelectedItem(null);
          }}
          role="presentation"
        >
          <div
            className="admin-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Application ${selectedItem.id}`}
          >
            <div className="admin-modal-header">
              <h2>Application Details: {selectedItem.id}</h2>
              <button
                type="button"
                className="admin-close-btn"
                onClick={() => {
                  setSelectedId(null);
                  setSelectedItem(null);
                }}
              >
                x
              </button>
            </div>

            {loadingSelectedItem && <p className="admin-meta-note">Refreshing details...</p>}

            <div className="admin-modal-grid">
              <div>
                <div className="admin-field-label">Name</div>
                <div>{selectedItem.name || "-"}</div>
              </div>
              <div>
                <div className="admin-field-label">Email</div>
                <div>{selectedItem.email || "-"}</div>
              </div>
            </div>

            <div className="admin-modal-grid">
              <div>
                <div className="admin-field-label">Title</div>
                <div>{selectedItem.title || "-"}</div>
              </div>
              <div>
                <div className="admin-field-label">Audio URL</div>
                <div className="admin-content-box">{selectedAudioUrl || "-"}</div>
              </div>
            </div>

            <div className="admin-modal-section">
              <div className="admin-field-label">Audio Player</div>
              {selectedAudioUrl ? <AudioPlayer src={selectedAudioUrl} /> : <div className="admin-content-box">-</div>}
              {selectedAudioUrl ? (
                <a className="admin-audio-link" href={selectedAudioUrl} target="_blank" rel="noreferrer">
                  Open audio in new tab
                </a>
              ) : null}
            </div>

            <div className="admin-modal-section">
              <div className="admin-field-label">Status</div>
              <span className={getStatusClassName(selectedItem.status)}>{selectedStatusLabel}</span>
            </div>

            <div className="admin-modal-section">
              <div className="admin-field-label">Question 1</div>
              <div className="admin-content-box">{selectedItem.new_question_1 || "-"}</div>
            </div>

            <div className="admin-modal-section">
              <div className="admin-field-label">Question 2</div>
              <div className="admin-content-box">{selectedItem.new_question_2 || "-"}</div>
            </div>

            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-btn admin-btn-reject"
                onClick={() => handleUpdateStatus("rejected")}
                disabled={updatingStatus}
              >
                Reject
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-approve"
                onClick={() => handleUpdateStatus("approved")}
                disabled={updatingStatus}
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminApp;
