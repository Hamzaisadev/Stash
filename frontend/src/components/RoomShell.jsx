import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  FileText,
  ClipboardList,
  MonitorPlay,
  Plus,
  KeyRound,
  Settings2,
  Trash2,
  LogOut,
  X,
} from "lucide-react";

/**
 * The room shell.
 *
 * Replaces the sidebar + 8 modals. Three ideas:
 *
 *  1. The room link is always on screen. Sharing a room was the product's
 *     core act and it was buried two clicks deep in a dialog.
 *  2. Rooms are a switcher pill, not a permanent column. A list of rooms is
 *     not worth 260px of every screen on a tool you use for 10 seconds.
 *  3. Settings, join and create open as inline panels that push content
 *     down, not dialogs that trap focus and hide the room behind a scrim.
 *
 * The three modes stay separate — files persist, clipboard is a running log,
 * screen share is a live stream — but carry live counts so you can see a
 * clipboard entry arrive while you are looking at files.
 */
export default function RoomShell({
  room,
  myRooms,
  joinedRooms,
  activeMode,
  onChangeMode,
  counts,
  isHost,
  onSwitchRoom,
  onCreateRoom,
  onJoinRoom,
  onUpdateRoom,
  onDeleteRoom,
  onLeaveRoom,
  onRotateKey,
  isLive,
  children,
}) {
  const [panel, setPanel] = useState(null); // 'rooms' | 'settings' | 'join' | 'create'
  const [copied, setCopied] = useState(false);
  const shellRef = useRef(null);

  const link =
    typeof window !== "undefined" && room.id
      ? `${window.location.origin}/rooms/${room.id}`
      : "";

  const togglePanel = (name) => setPanel((p) => (p === name ? null : name));

  // Escape closes whatever is open. Panels are not focus traps, so this is
  // the only global key handling they need.
  useEffect(() => {
    if (!panel) return;
    const onKey = (e) => e.key === "Escape" && setPanel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the link is selectable in the field */
    }
  };

  const MODES = [
    { id: "files", label: "Files", icon: FileText, count: counts.files },
    { id: "clipboard", label: "Clipboard", icon: ClipboardList, count: counts.clipboard },
    { id: "screen", label: "Screen", icon: MonitorPlay, live: isLive },
  ];

  return (
    <div className="rs" ref={shellRef}>
      <a className="rs__skip" href="#room-main">
        Skip to content
      </a>

      {/* ── bar ─────────────────────────────────────────────── */}
      <header className="rs__bar">
        <a href="/" className="rs__mark" aria-label="Stash, home">
          <span className="rs__mark-chip" aria-hidden="true" />
          stash
        </a>

        <div className="rs__room">
          <button
            type="button"
            className="rs__pill"
            onClick={() => togglePanel("rooms")}
            aria-expanded={panel === "rooms"}
            aria-controls="rs-panel-rooms"
          >
            <span className="rs__pill-name">{room.name || room.id || "default"}</span>
            <ChevronDown aria-hidden="true" className={panel === "rooms" ? "is-open" : ""} />
          </button>
          {room.is_protected && (
            <span className="rs__badge" title="This room needs an access code">
              locked
            </span>
          )}
        </div>

        <div className="rs__bar-actions">
          {isHost && (
            <button
              type="button"
              className="rs__icon"
              onClick={() => togglePanel("settings")}
              aria-expanded={panel === "settings"}
              aria-controls="rs-panel-settings"
              aria-label="Room settings"
            >
              <Settings2 aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      {/* ── the share strip: always visible, never a dialog ──── */}
      <div className="rs__share">
        <span className="rs__share-label">Room link</span>
        {link ? (
          <>
            <input
              className="rs__share-link"
              value={link}
              readOnly
              onFocus={(e) => e.target.select()}
              aria-label="Room link, select to copy"
            />
            <button type="button" className="rs__copy" onClick={copyLink}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </>
        ) : (
          <span className="rs__share-link rs__share-link--empty">
            Connecting to a room…
          </span>
        )}
      </div>

      {/* ── panels: inline, push content, no scrim ───────────── */}
      {panel === "rooms" && (
        <Panel id="rs-panel-rooms" title="Rooms" onClose={() => setPanel(null)}>
          <div className="rs__roomgrid">
            {[...myRooms, ...joinedRooms].length === 0 && (
              <p className="rs__hint">No rooms yet. Create one, or join with a code.</p>
            )}
            {myRooms.map((r) => (
              <RoomChip
                key={r.id}
                room={r}
                current={r.id === room.id}
                owned
                onPick={() => {
                  onSwitchRoom(r.id);
                  setPanel(null);
                }}
                onRemove={() => onDeleteRoom(r.id)}
              />
            ))}
            {joinedRooms.map((r) => (
              <RoomChip
                key={r.id}
                room={r}
                current={r.id === room.id}
                onPick={() => {
                  onSwitchRoom(r.id);
                  setPanel(null);
                }}
                onRemove={() => onLeaveRoom(r.id)}
              />
            ))}
          </div>
          <div className="rs__panel-actions">
            <button type="button" className="rs__btn" onClick={() => setPanel("create")}>
              <Plus aria-hidden="true" /> New room
            </button>
            <button type="button" className="rs__btn rs__btn--ghost" onClick={() => setPanel("join")}>
              <KeyRound aria-hidden="true" /> Join with a code
            </button>
          </div>
        </Panel>
      )}

      {panel === "create" && (
        <Panel id="rs-panel-create" title="New room" onClose={() => setPanel(null)}>
          <CreateForm
            onSubmit={async (data) => {
              const res = await onCreateRoom(data);
              if (res?.success) setPanel(null);
              return res;
            }}
          />
        </Panel>
      )}

      {panel === "join" && (
        <Panel id="rs-panel-join" title="Join a room" onClose={() => setPanel(null)}>
          <JoinForm
            onSubmit={async (id) => {
              await onJoinRoom(id);
              setPanel(null);
            }}
          />
        </Panel>
      )}

      {panel === "settings" && (
        <Panel id="rs-panel-settings" title="Room settings" onClose={() => setPanel(null)}>
          <SettingsForm
            room={room}
            onSave={onUpdateRoom}
            onRotateKey={onRotateKey}
            onDelete={() => {
              onDeleteRoom(room.id);
              setPanel(null);
            }}
          />
        </Panel>
      )}

      {/* ── mode rail ────────────────────────────────────────── */}
      <nav className="rs__modes" aria-label="Room modes">
        {MODES.map((m) => {
          const Icon = m.icon;
          const on = activeMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChangeMode(m.id)}
              aria-current={on ? "page" : undefined}
              className={`rs__mode ${on ? "is-on" : ""}`}
            >
              <Icon aria-hidden="true" />
              <span>{m.label}</span>
              {m.count > 0 && <span className="rs__mode-count">{m.count}</span>}
              {m.live && <span className="rs__mode-live" aria-label="live now" />}
            </button>
          );
        })}
      </nav>

      <main id="room-main" className="rs__main">
        {children}
      </main>
    </div>
  );
}

/* ── an inline panel ───────────────────────────────────────── */
function Panel({ id, title, onClose, children }) {
  return (
    <section className="rs__panel" id={id} aria-label={title}>
      <header className="rs__panel-head">
        <h2>{title}</h2>
        <button type="button" onClick={onClose} aria-label={`Close ${title}`}>
          <X aria-hidden="true" />
        </button>
      </header>
      {children}
    </section>
  );
}

function RoomChip({ room, current, owned, onPick, onRemove }) {
  return (
    <div className={`rs__roomchip ${current ? "is-current" : ""}`}>
      <button type="button" onClick={onPick} className="rs__roomchip-pick">
        <span className="rs__roomchip-name">{room.name || room.id}</span>
        <span className="rs__roomchip-role">{owned ? "yours" : "joined"}</span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="rs__roomchip-x"
        aria-label={owned ? `Delete ${room.name || room.id}` : `Leave ${room.name || room.id}`}
      >
        {owned ? <Trash2 aria-hidden="true" /> : <LogOut aria-hidden="true" />}
      </button>
    </div>
  );
}

function CreateForm({ onSubmit }) {
  const [name, setName] = useState("");
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="rs__form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || busy) return;
        setBusy(true);
        await onSubmit({ name: name.trim(), is_protected: locked });
        setBusy(false);
      }}
    >
      <label className="rs__field">
        <span>Room name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="design-handoff"
          maxLength={60}
          autoFocus
        />
      </label>
      <label className="rs__check">
        <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} />
        <span>Require a 6-digit code to enter</span>
      </label>
      <button type="submit" className="rs__btn" disabled={!name.trim() || busy}>
        {busy ? "Creating…" : "Create room"}
      </button>
      <p className="rs__hint">Rooms and everything in them are deleted after 24 hours.</p>
    </form>
  );
}

function JoinForm({ onSubmit }) {
  const [id, setId] = useState("");
  return (
    <form
      className="rs__form"
      onSubmit={(e) => {
        e.preventDefault();
        if (id.trim()) onSubmit(id.trim());
      }}
    >
      <label className="rs__field">
        <span>Room name or link</span>
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="design-handoff"
          autoFocus
        />
      </label>
      <button type="submit" className="rs__btn" disabled={!id.trim()}>
        Go to room
      </button>
      <p className="rs__hint">
        If the room is locked you will be asked for its code next.
      </p>
    </form>
  );
}

function SettingsForm({ room, onSave, onRotateKey, onDelete }) {
  const [name, setName] = useState(room.name || "");
  const [desc, setDesc] = useState(room.description || "");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="rs__form">
      <label className="rs__field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      </label>
      <label className="rs__field">
        <span>Description</span>
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          maxLength={160}
          placeholder="What is this room for?"
        />
      </label>

      <div className="rs__panel-actions">
        <button
          type="button"
          className="rs__btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onSave(room.id, { name: name.trim(), description: desc.trim() });
            setBusy(false);
          }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {room.is_protected && (
          <button type="button" className="rs__btn rs__btn--ghost" onClick={() => onRotateKey(room.id)}>
            New access code
          </button>
        )}
      </div>

      <div className="rs__danger">
        {confirmDelete ? (
          <>
            <p>Delete this room and everything in it? This cannot be undone.</p>
            <div className="rs__panel-actions">
              <button type="button" className="rs__btn rs__btn--danger" onClick={onDelete}>
                Yes, delete it
              </button>
              <button
                type="button"
                className="rs__btn rs__btn--ghost"
                onClick={() => setConfirmDelete(false)}
              >
                Keep it
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="rs__linkish"
            onClick={() => setConfirmDelete(true)}
          >
            Delete this room
          </button>
        )}
      </div>
    </div>
  );
}
