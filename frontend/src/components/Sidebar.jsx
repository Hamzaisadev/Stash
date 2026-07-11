import React, { useState } from 'react';

export default function Sidebar({
    myRooms,
    joinedRooms,
    currentRoomId,
    setRoomId,
    createRoom,
    fetchDefaultRoom
}) {
    const [isCreating, setIsCreating] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newRoomName.trim()) return;
        const res = await createRoom({ name: newRoomName });
        if (res.success) {
            setIsCreating(false);
            setNewRoomName('');
        }
    };

    return (
        <div className="w-64 bg-[#111111] border-r border-gray-800 h-screen flex flex-col hidden md:flex shrink-0">
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-semibold text-lg cursor-pointer" onClick={() => fetchDefaultRoom()}>
                    <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    Stash
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
                
                {/* My Rooms Section */}
                <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2 flex justify-between items-center">
                        My Rooms
                        <button onClick={() => setIsCreating(!isCreating)} className="hover:text-white transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                    </div>
                    {isCreating && (
                        <form onSubmit={handleCreate} className="mb-2 px-2">
                            <input 
                                type="text" 
                                autoFocus
                                value={newRoomName}
                                onChange={(e) => setNewRoomName(e.target.value)}
                                placeholder="Room name..."
                                className="w-full bg-[#1C1C1E] text-sm text-white rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 border border-gray-700"
                                onBlur={() => setIsCreating(false)}
                            />
                        </form>
                    )}
                    <ul className="space-y-1">
                        {myRooms.map(r => (
                            <li key={r.id}>
                                <button
                                    onClick={() => setRoomId(r.id)}
                                    className={`w-full text-left px-2 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                                        currentRoomId === r.id ? 'bg-[#2A2A2D] text-white' : 'text-gray-400 hover:bg-[#1C1C1E] hover:text-gray-200'
                                    }`}
                                >
                                    <span className="truncate flex-1">{r.name || r.id}</span>
                                </button>
                            </li>
                        ))}
                        {myRooms.length === 0 && !isCreating && (
                            <li className="px-2 py-1 text-xs text-gray-600">No rooms created yet.</li>
                        )}
                    </ul>
                </div>

                {/* Joined Rooms Section */}
                {joinedRooms.length > 0 && (
                    <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                            Joined Rooms
                        </div>
                        <ul className="space-y-1">
                            {joinedRooms.map(r => (
                                <li key={r.id}>
                                    <button
                                        onClick={() => setRoomId(r.id)}
                                        className={`w-full text-left px-2 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                                            currentRoomId === r.id ? 'bg-[#2A2A2D] text-white' : 'text-gray-400 hover:bg-[#1C1C1E] hover:text-gray-200'
                                        }`}
                                    >
                                        <span className="truncate flex-1">{r.id}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-gray-800">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    Connected to Server
                </div>
            </div>
        </div>
    );
}
