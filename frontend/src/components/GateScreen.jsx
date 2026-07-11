import React, { useState, useEffect } from 'react';

export default function GateScreen({ 
    gate, 
    joinRoomWithKey, 
    requestAccessAcceptOnly,
    fetchRoomDetails
}) {
    const [password, setPassword] = useState("");
    const [username, setUsername] = useState("");
    const [statusMsg, setStatusMsg] = useState("");
    const [loading, setLoading] = useState(false);
    const [requested, setRequested] = useState(false);

    useEffect(() => {
        // Listen for approval/denial events
        const onApproved = (e) => {
            if (e.detail.roomId === gate.room_id) {
                setStatusMsg("Approved! Joining...");
                fetchRoomDetails(gate.room_id);
            }
        };
        const onDenied = (e) => {
            if (e.detail.roomId === gate.room_id) {
                setStatusMsg("Request Denied by Host.");
                setRequested(false);
            }
        };

        window.addEventListener('stash-join-approved', onApproved);
        window.addEventListener('stash-join-denied', onDenied);
        return () => {
            window.removeEventListener('stash-join-approved', onApproved);
            window.removeEventListener('stash-join-denied', onDenied);
        };
    }, [gate.room_id, fetchRoomDetails]);

    const handleJoin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatusMsg("");
        const res = await joinRoomWithKey(gate.room_id, password);
        if (res.success) {
            fetchRoomDetails(gate.room_id);
        } else {
            setStatusMsg(res.error || "Incorrect password.");
        }
        setLoading(false);
    };

    const handleRequestAccess = (e) => {
        e.preventDefault();
        if (!username.trim()) {
            setStatusMsg("Please enter a username.");
            return;
        }
        requestAccessAcceptOnly(gate.room_id, username);
        setRequested(true);
        setStatusMsg("Request sent. Waiting for host approval...");
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-[#0E0E10] text-gray-200">
            <div className="bg-[#1C1C1E] p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-800">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 text-blue-400 mb-4">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white">Private Room</h2>
                    <p className="text-gray-400 mt-2 text-sm">Room: <span className="font-mono text-gray-300">{gate.room_id}</span></p>
                </div>

                {gate.accept_only && !gate.require_password ? (
                    <form onSubmit={handleRequestAccess} className="space-y-4">
                        <p className="text-sm text-gray-400 text-center">This room requires manual approval from the host.</p>
                        <div>
                            <input 
                                type="text"
                                placeholder="Enter your name (e.g. John)" 
                                className="w-full bg-[#2A2A2D] text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={requested}
                                required
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={requested || loading}
                            className={`w-full py-3 rounded-xl font-medium transition-colors ${requested ? 'bg-blue-600/50 text-blue-200 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                        >
                            {requested ? 'Waiting...' : 'Request Access'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleJoin} className="space-y-4">
                        <p className="text-sm text-gray-400 text-center">Enter the room key to join.</p>
                        <div>
                            <input 
                                type="text"
                                placeholder="Room Key" 
                                className="w-full bg-[#2A2A2D] text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest text-center border border-gray-700 uppercase"
                                value={password}
                                onChange={(e) => setPassword(e.target.value.toUpperCase())}
                                required
                                maxLength={6}
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-medium transition-colors"
                        >
                            {loading ? 'Verifying...' : 'Unlock'}
                        </button>
                    </form>
                )}

                {statusMsg && (
                    <div className={`mt-6 text-center text-sm p-3 rounded-xl ${statusMsg.includes('Denied') || statusMsg.includes('Incorrect') ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                        {statusMsg}
                    </div>
                )}
            </div>
        </div>
    );
}
