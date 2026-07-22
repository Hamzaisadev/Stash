import React, { useState, useEffect } from "react";

export default function SettingsDrawer({
  room,
  updateRoomSettings,
  rotateStackKey,
  approveGuest,
  denyGuest,
  deleteRoom,
  isOpen,
  onClose,
}) {
  const [requests, setRequests] = useState([]);
  const [localName, setLocalName] = useState(room.name || "");
  const [localDescription, setLocalDescription] = useState(
    room.description || "",
  );

  // Synchronize local inputs with room props when room changes
  useEffect(() => {
    setLocalName(room.name || "");
    setLocalDescription(room.description || "");
  }, [room.id, room.name, room.description]);

  useEffect(() => {
    const handleRequest = (e) => {
      const data = e.detail;
      if (data.roomId === room.id) {
        setRequests((prev) => {
          if (prev.find((r) => r.clientId === data.clientId)) return prev;
          return [...prev, data];
        });
      }
    };

    window.addEventListener("stash-join-request", handleRequest);
    return () =>
      window.removeEventListener("stash-join-request", handleRequest);
  }, [room.id]);

  const handleApprove = (clientId, socketId) => {
    approveGuest(room.id, socketId, clientId);
    setRequests((prev) => prev.filter((r) => r.clientId !== clientId));
  };

  const handleDeny = (clientId, socketId) => {
    denyGuest(room.id, socketId);
    setRequests((prev) => prev.filter((r) => r.clientId !== clientId));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-[#1C1C1E] border-l border-gray-800 shadow-2xl z-50 flex flex-col transform transition-transform duration-300">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Room Settings</h2>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-white rounded-full hover:bg-gray-800 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8">
        {/* General Settings */}
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400">Room Name</label>
            <input
              type="text"
              className="w-full bg-[#2A2A2D] text-white rounded px-3 py-2 mt-1 focus:outline-none focus:ring-1 focus:ring-blue-500 border border-gray-700"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={() => updateRoomSettings(room.id, { name: localName })}
            />
          </div>
          <div>
            <label className="text-sm text-gray-400">Description</label>
            <textarea
              className="w-full bg-[#2A2A2D] text-white rounded px-3 py-2 mt-1 focus:outline-none focus:ring-1 focus:ring-blue-500 border border-gray-700 text-sm"
              value={localDescription}
              onChange={(e) => setLocalDescription(e.target.value)}
              onBlur={() =>
                updateRoomSettings(room.id, { description: localDescription })
              }
              rows="2"
            />
          </div>
        </div>

        {/* Security Settings */}
        <div className="space-y-4 pt-4 border-t border-gray-800">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Security
          </h3>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-white">Private Room</span>
            <input
              type="checkbox"
              className="form-checkbox h-5 w-5 text-blue-500 rounded bg-gray-700 border-gray-600 focus:ring-blue-500 focus:ring-offset-gray-900"
              checked={room.is_protected}
              onChange={(e) =>
                updateRoomSettings(room.id, { is_protected: e.target.checked })
              }
            />
          </label>

          {room.is_protected && (
            <div className="bg-[#111111] p-3 rounded-xl border border-gray-800">
              <div className="text-xs text-gray-400 mb-1">
                Room Key (6 chars)
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-lg font-bold text-white tracking-widest">
                  {room.stack_key || "------"}
                </span>
                <button
                  onClick={() => rotateStackKey(room.id)}
                  className="text-blue-400 hover:text-blue-300 text-xs px-2 py-1 rounded bg-blue-500/10 transition-colors"
                >
                  Rotate
                </button>
              </div>
            </div>
          )}

          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex flex-col">
              <span className="text-sm text-white">Manual Approval</span>
              <span className="text-xs text-gray-500">
                Require host to approve joins
              </span>
            </div>
            <input
              type="checkbox"
              className="form-checkbox h-5 w-5 text-blue-500 rounded bg-gray-700 border-gray-600 focus:ring-blue-500 focus:ring-offset-gray-900"
              checked={room.accept_only}
              onChange={(e) =>
                updateRoomSettings(room.id, { accept_only: e.target.checked })
              }
            />
          </label>
        </div>

        {/* Access Requests */}
        {requests.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-gray-800">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center justify-between">
              Access Requests
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {requests.length}
              </span>
            </h3>
            <div className="space-y-2">
              {requests.map((req) => (
                <div
                  key={req.clientId}
                  className="bg-[#2A2A2D] p-3 rounded-xl flex items-center justify-between border border-gray-700"
                >
                  <div className="flex flex-col truncate pr-2">
                    <span className="text-sm font-medium text-white truncate">
                      {req.guestName}
                    </span>
                    <span className="text-xs text-gray-500 font-mono truncate">
                      {req.clientId.substring(0, 12)}...
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() =>
                        handleApprove(req.clientId, req.guestSocketId)
                      }
                      className="p-1.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() =>
                        handleDeny(req.clientId, req.guestSocketId)
                      }
                      className="p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delete Room Option */}
        {room.creator_socket_id !== "system" && (
          <div className="pt-6 border-t border-gray-800">
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Are you sure you want to delete this room and all its files? This action is permanent.",
                  )
                ) {
                  deleteRoom(room.id);
                  onClose();
                }
              }}
              className="w-full py-2.5 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-500 hover:text-red-400 font-medium transition-colors border border-red-500/20"
            >
              Delete Room
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
