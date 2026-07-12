import React, { useState } from 'react';
import { 
  Sidebar as ShadcnSidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarFooter
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Share2, 
  Trash2, 
  LogOut, 
  FolderHeart,
  FileText,
  ClipboardList,
  Mic,
  MonitorPlay,
  KeyRound
} from "lucide-react";

export default function Sidebar({
    myRooms,
    joinedRooms,
    currentRoomId,
    setRoomId,
    createRoom,
    deleteRoom,
    leaveRoom,
    onOpenJoinModal,
    fetchDefaultRoom,
    activeMode,
    onChangeMode,
    roomFileCount,
    clipboardCount,
    onOpenShareForRoom
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
        } else {
            alert(res.error || 'Failed to create room');
        }
    };

    return (
        <ShadcnSidebar className="border-r border-slate-900 bg-[#0c0c10] select-none text-slate-200">
            <SidebarHeader className="p-4 border-b border-slate-900/50">
                <div 
                    className="flex items-center gap-2.5 text-white font-bold text-base cursor-pointer hover:opacity-90 transition-opacity" 
                    onClick={() => fetchDefaultRoom()}
                >
                    <FolderHeart className="w-5.5 h-5.5 text-indigo-500 fill-indigo-500/20" />
                    <span className="tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">Stash</span>
                </div>
            </SidebarHeader>

            <SidebarContent className="px-3 py-4 space-y-6">
                
                {/* Stash Tools Section */}
                <SidebarGroup>
                    <SidebarGroupLabel className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">
                        Stash Tools
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu className="space-y-1">
                            {[
                                { id: 'files', label: 'Files', count: roomFileCount, icon: <FileText className="w-4 h-4" /> },
                                { id: 'clipboard', label: 'Clipboard', count: clipboardCount, icon: <ClipboardList className="w-4 h-4" /> },
                                { id: 'voice', label: 'Voice Notes', count: null, icon: <Mic className="w-4 h-4" /> },
                                { id: 'screen', label: 'Screen Share', count: null, icon: <MonitorPlay className="w-4 h-4" /> }
                            ].map(item => (
                                <SidebarMenuItem key={item.id}>
                                    <SidebarMenuButton
                                        onClick={() => onChangeMode(item.id)}
                                        isActive={activeMode === item.id}
                                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center gap-2.5 transition-all cursor-pointer ${
                                            activeMode === item.id 
                                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/25' 
                                                : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
                                        }`}
                                    >
                                        <span className={activeMode === item.id ? "text-white" : "text-slate-500"}>
                                            {item.icon}
                                        </span>
                                        <span className="flex-grow">{item.label}</span>
                                        {item.count !== null && item.count > 0 && (
                                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full transition-all ${
                                                activeMode === item.id ? 'bg-white/25 text-white' : 'bg-slate-900 text-slate-400'
                                            }`}>
                                                {item.count}
                                            </span>
                                        )}
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                
                {/* My Rooms Section */}
                <SidebarGroup>
                    <SidebarGroupLabel className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1 flex justify-between items-center w-full">
                        <span>My Rooms</span>
                        <div className="flex items-center space-x-1.5 text-slate-500">
                            <button onClick={() => setIsCreating(!isCreating)} className="hover:text-slate-200 transition-colors p-0.5" title="Create Room">
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={onOpenJoinModal} className="hover:text-slate-200 transition-colors p-0.5" title="Join Room Manually">
                                <KeyRound className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </SidebarGroupLabel>
                    
                    <SidebarGroupContent className="space-y-2">
                        {isCreating && (
                            <form onSubmit={handleCreate} className="px-1 mb-1">
                                <Input 
                                    type="text" 
                                    autoFocus
                                    value={newRoomName}
                                    onChange={(e) => setNewRoomName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                            setIsCreating(false);
                                            setNewRoomName('');
                                        }
                                    }}
                                    placeholder="Room name..."
                                    className="bg-slate-950 border-slate-900 text-xs px-2.5 py-1.5 h-8 focus:ring-indigo-500"
                                />
                            </form>
                        )}
                        <SidebarMenu className="space-y-1">
                            {myRooms.map(r => (
                                <SidebarMenuItem key={r.id} className="group/item relative flex items-center justify-between rounded-xl hover:bg-slate-900/40 transition-all">
                                    <SidebarMenuButton
                                        onClick={() => setRoomId(r.id)}
                                        isActive={currentRoomId === r.id}
                                        className={`flex-grow text-left px-2.5 py-2 text-xs truncate flex items-center gap-2 cursor-pointer transition-colors ${
                                            currentRoomId === r.id ? 'bg-slate-900 text-white font-medium rounded-xl' : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                    >
                                        <span className="truncate flex-1 pr-12">{r.name || 'stash:default'}</span>
                                    </SidebarMenuButton>
                                    
                                    <div className="absolute right-1.5 flex items-center space-x-1 shrink-0 opacity-100 md:opacity-0 md:group-hover/item:opacity-100 transition-opacity pl-2 py-0.5 rounded-r-xl bg-transparent">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onOpenShareForRoom(r.id);
                                            }}
                                            className="p-1 hover:bg-slate-800 rounded-md text-slate-500 hover:text-white transition-colors"
                                            title="Share & Security"
                                        >
                                            <Share2 className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteRoom(r.id);
                                            }}
                                            className="p-1 hover:bg-red-950/20 rounded-md text-slate-500 hover:text-red-400 transition-colors"
                                            title="Delete Room"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </SidebarMenuItem>
                            ))}
                            {myRooms.length === 0 && !isCreating && (
                                <li className="px-2.5 py-1 text-[11px] text-slate-600">No rooms created yet.</li>
                            )}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* Joined Rooms Section */}
                {joinedRooms.length > 0 && (
                    <SidebarGroup>
                        <SidebarGroupLabel className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">
                            Joined Rooms
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu className="space-y-1">
                                {joinedRooms.map(r => (
                                    <SidebarMenuItem key={r.id} className="group/item relative flex items-center justify-between rounded-xl hover:bg-slate-900/40 transition-all">
                                        <SidebarMenuButton
                                            onClick={() => setRoomId(r.id)}
                                            isActive={currentRoomId === r.id}
                                            className={`flex-grow text-left px-2.5 py-2 text-xs truncate flex items-center gap-2 cursor-pointer transition-colors ${
                                                currentRoomId === r.id ? 'bg-slate-900 text-white font-medium rounded-xl' : 'text-slate-400 hover:text-slate-200'
                                            }`}
                                        >
                                            <span className="truncate flex-1 pr-12">{r.name || r.id}</span>
                                        </SidebarMenuButton>
                                        
                                        <div className="absolute right-1.5 flex items-center space-x-1 shrink-0 opacity-100 md:opacity-0 md:group-hover/item:opacity-100 transition-opacity pl-2 py-0.5 rounded-r-xl bg-transparent">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onOpenShareForRoom(r.id);
                                                }}
                                                className="p-1 hover:bg-slate-800 rounded-md text-slate-500 hover:text-white transition-colors"
                                                title="Share & Security"
                                            >
                                                <Share2 className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    leaveRoom(r.id);
                                                }}
                                                className="p-1 hover:bg-red-950/20 rounded-md text-slate-500 hover:text-yellow-500 transition-colors"
                                                title="Leave Room"
                                            >
                                                <LogOut className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}
            </SidebarContent>

        </ShadcnSidebar>
    );
}
