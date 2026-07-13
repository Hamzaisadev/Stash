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
        <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-800 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 animate-scaleUp">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 text-red-500 mb-4 shadow-sm">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Private Room</h2>
                    <p className="text-slate-500 mt-1.5 text-sm">Room: <span className="font-mono text-slate-700 font-bold">{gate.room_id}</span></p>
                </div>

                {gate.accept_only && !gate.require_password ? (
                    <form onSubmit={handleRequestAccess} className="space-y-4">
                        <p className="text-sm text-slate-500 text-center">This room requires manual approval from the host.</p>
                        <div>
                            <input 
                                type="text"
                                placeholder="Enter your name (e.g. John)" 
                                className="w-full bg-white text-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/55 border border-slate-200 focus:border-red-500"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={requested}
                                required
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={requested || loading}
                            className={`w-full py-3 rounded-xl font-semibold transition-colors cursor-pointer ${requested ? 'bg-red-500/40 text-white/80 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 text-white shadow-sm'}`}
                        >
                            {requested ? 'Waiting...' : 'Request Access'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleJoin} className="space-y-4">
                        <p className="text-sm text-slate-500 text-center">Enter the room key to join.</p>
                        <div>
                            <input 
                                type="text"
                                placeholder="Room Key" 
                                className="w-full bg-white text-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/55 font-mono tracking-widest text-center border border-slate-200 focus:border-red-500 uppercase font-bold"
                                value={password}
                                onChange={(e) => setPassword(e.target.value.toUpperCase())}
                                required
                                maxLength={6}
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-semibold transition-colors shadow-sm cursor-pointer"
                        >
                            {loading ? 'Verifying...' : 'Unlock'}
                        </button>
                    </form>
                )}

                {statusMsg && (
                    <div className={`mt-6 text-center text-sm p-3 rounded-xl border ${statusMsg.includes('Denied') || statusMsg.includes('Incorrect') ? 'bg-red-50 border-red-100 text-red-600' : 'bg-slate-50 border-slate-255 text-slate-650 animate-pulse-soft'}`}>
                        {statusMsg}
                    </div>
                )}
            </div>
        </div>
    );
}
