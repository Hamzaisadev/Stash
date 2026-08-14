import React, { useState, useEffect } from 'react';
import { Globe, Lock, ShieldCheck, Wifi } from 'lucide-react';

export default function GateScreen({ 
    gate, 
    joinRoomWithKey, 
    joinRemoteRoom,
    isRemoteRoom,
    requestAccessAcceptOnly,
    fetchRoomDetails
}) {
    const [password, setPassword] = useState("");
    const [username, setUsername] = useState("");
    const [statusMsg, setStatusMsg] = useState("");
    const [loading, setLoading] = useState(false);
    const [requested, setRequested] = useState(false);

    const isRemote = isRemoteRoom || (typeof gate.room_id === 'string' && gate.room_id.startsWith('remote-'));

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
        
        const joinFn = (isRemote && joinRemoteRoom) ? joinRemoteRoom : joinRoomWithKey;
        const res = await joinFn(gate.room_id, password.trim());
        
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
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 shadow-sm ${
                        isRemote ? 'bg-indigo-50 text-indigo-600' : 'bg-red-50 text-red-500'
                    }`}>
                        {isRemote ? (
                            <Globe className="w-8 h-8" />
                        ) : (
                            <Lock className="w-8 h-8" />
                        )}
                    </div>
                    
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                        {isRemote ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <Globe className="w-3 h-3 text-indigo-500" />
                                Remote Internet Room
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Wifi className="w-3 h-3 text-emerald-500" />
                                Local Network Room
                            </span>
                        )}
                    </div>

                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                        {isRemote ? "Protected Remote Room" : "Private Room"}
                    </h2>
                    <p className="text-slate-500 mt-1.5 text-sm">
                        Room ID: <span className="font-mono text-slate-700 font-bold">{gate.room_id}</span>
                    </p>
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
                        <p className="text-sm text-slate-500 text-center">
                            {isRemote ? "Enter the room password to connect." : "Enter the room passcode / Stash Key to join."}
                        </p>
                        <div>
                            <input 
                                type="password"
                                placeholder="Room Password" 
                                className="w-full bg-white text-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/55 font-mono tracking-wider text-center border border-slate-200 focus:border-indigo-500 font-bold"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={loading || !password.trim()}
                            className={`w-full text-white py-3 rounded-xl font-semibold transition-colors shadow-sm cursor-pointer ${
                                isRemote 
                                    ? 'bg-indigo-600 hover:bg-indigo-700' 
                                    : 'bg-red-500 hover:bg-red-600'
                            }`}
                        >
                            {loading ? 'Verifying & Connecting...' : 'Unlock Room'}
                        </button>
                    </form>
                )}

                {statusMsg && (
                    <div className={`mt-6 text-center text-sm p-3 rounded-xl border ${statusMsg.includes('Denied') || statusMsg.includes('Incorrect') ? 'bg-red-50 border-red-100 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-600 animate-pulse'}`}>
                        {statusMsg}
                    </div>
                )}
            </div>
        </div>
    );
}
