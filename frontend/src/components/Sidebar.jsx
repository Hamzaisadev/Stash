import React, { useState } from "react";
import { toast } from "sonner";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Share2,
  Trash2,
  LogOut,
  FileText,
  ClipboardList,
  MonitorPlay,
  KeyRound,
  Globe,
  Wifi,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  Shield,
} from "lucide-react";

export default function Sidebar({
  myRooms,
  joinedRooms,
  currentRoomId,
  isRemoteRoom,
  setRoomId,
  createRoom,
  createRemoteRoom,
  deleteRoom,
  leaveRoom,
  onOpenJoinModal,
  fetchDefaultRoom,
  activeMode,
  onChangeMode,
  roomFileCount,
  clipboardCount,
  onOpenShareForRoom,
}) {
  const { isMobile, setOpenMobile } = useSidebar();

  // Create Standard Room Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [customRoomId, setCustomRoomId] = useState("");
  const [isProtected, setIsProtected] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [acceptOnly, setAcceptOnly] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create Remote Room Modal States
  const [showRemoteCreateModal, setShowRemoteCreateModal] = useState(false);
  const [remoteName, setRemoteName] = useState("");
  const [remotePassword, setRemotePassword] = useState("");
  const [showRemotePassword, setShowRemotePassword] = useState(false);
  const [remoteDescription, setRemoteDescription] = useState("");
  const [remoteCustomId, setRemoteCustomId] = useState("");
  const [isSubmittingRemote, setIsSubmittingRemote] = useState(false);

  // Join Remote Room Modal States
  const [showRemoteJoinModal, setShowRemoteJoinModal] = useState(false);
  const [joinRemoteId, setJoinRemoteId] = useState("");
  const [joinRemotePass, setJoinRemotePass] = useState("");
  const [showJoinRemotePass, setShowJoinRemotePass] = useState(false);
  const [isJoiningRemote, setIsJoiningRemote] = useState(false);

  const handleNavigation = (action) => {
    action();
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleCreateRoomSubmit = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await createRoom({
        name: roomName.trim(),
        id: customRoomId.trim() || undefined,
        description: roomDescription.trim(),
        is_protected: isProtected,
        password: isProtected ? passcode.trim() : undefined,
        accept_only: acceptOnly,
      });

      if (res.success) {
        setShowCreateModal(false);
        setRoomName("");
        setRoomDescription("");
        setCustomRoomId("");
        setIsProtected(false);
        setPasscode("");
        setAcceptOnly(false);
        toast.success("Room created successfully!");
      } else {
        toast.error(res.error || "Failed to create room.");
      }
    } catch (err) {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateRandomRemotePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let pass = "";
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setRemotePassword(pass);
  };

  const handleCreateRemoteRoomSubmit = async (e) => {
    e.preventDefault();
    if (!remoteName.trim()) {
      return toast.error("Remote Room Name is required");
    }
    if (!remotePassword.trim()) {
      return toast.error("A secure password is required for Remote Rooms");
    }

    setIsSubmittingRemote(true);
    try {
      const res = await createRemoteRoom({
        name: remoteName.trim(),
        password: remotePassword.trim(),
        description: remoteDescription.trim(),
        id: remoteCustomId.trim() || undefined,
      });

      if (res.success) {
        setShowRemoteCreateModal(false);
        setRemoteName("");
        setRemotePassword("");
        setRemoteDescription("");
        setRemoteCustomId("");
        toast.success("Remote Room created & secured!");
      } else {
        toast.error(res.error || "Failed to create remote room.");
      }
    } catch (err) {
      toast.error("An unexpected error occurred creating remote room.");
    } finally {
      setIsSubmittingRemote(false);
    }
  };

  const handleJoinRemoteSubmit = async (e) => {
    e.preventDefault();
    if (!joinRemoteId.trim()) {
      return toast.error("Room ID is required");
    }
    if (!joinRemotePass.trim()) {
      return toast.error("Room Password is required");
    }

    setIsJoiningRemote(true);
    try {
      setRoomId(joinRemoteId.trim());
      setShowRemoteJoinModal(false);
      setJoinRemoteId("");
      setJoinRemotePass("");
    } catch (err) {
      toast.error(err.message || "Failed to join remote room");
    } finally {
      setIsJoiningRemote(false);
    }
  };

  return (
    <ShadcnSidebar className="border-r border-slate-200 bg-white select-none text-slate-800">
      <SidebarHeader className="p-4 border-b border-slate-200/50">
        <div
          className="flex items-center gap-2.5 text-slate-900 font-bold text-base cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => handleNavigation(fetchDefaultRoom)}
        >
          <div className="w-9 h-9 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center">
            <img src="/favicon.svg" alt="Stash logo" className="w-5 h-5" />
          </div>
          <span className="tracking-tight text-slate-900 font-extrabold">
            Stash
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4 space-y-5">
        {/* Network Mode Switcher / Local WiFi Quick Action */}
        <SidebarGroup>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Wifi className="w-3 h-3 text-emerald-500" />
                Network Mode
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold border border-emerald-200">
                Active
              </span>
            </div>
            <button
              onClick={() => handleNavigation(fetchDefaultRoom)}
              className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all cursor-pointer ${
                !isRemoteRoom
                  ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200"
                  : "text-slate-600 hover:bg-white/80"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Wifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">Local WiFi Network</span>
              </div>
              {!isRemoteRoom && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
              )}
            </button>
          </div>
        </SidebarGroup>

        {/* Remote Rooms Quick Panel */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1 flex justify-between items-center w-full">
            <span className="flex items-center gap-1 text-slate-500">
              <Globe className="w-3.5 h-3.5 text-indigo-500" />
              Remote Rooms
            </span>
            <span className="text-[9px] font-normal text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100 font-mono">
              Internet P2P
            </span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <Button
                onClick={() => setShowRemoteCreateModal(true)}
                variant="outline"
                className="h-8 px-2 text-[11px] font-semibold bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-700 border-slate-200 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-500" />
                <span>Create</span>
              </Button>
              <Button
                onClick={() => setShowRemoteJoinModal(true)}
                variant="outline"
                className="h-8 px-2 text-[11px] font-semibold bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-700 border-slate-200 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <KeyRound className="w-3.5 h-3.5 text-indigo-500" />
                <span>Join</span>
              </Button>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Stash Tools Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
            Stash Tools
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {[
                {
                  id: "files",
                  label: "Files",
                  count: roomFileCount,
                  icon: <FileText className="w-4 h-4" />,
                },
                {
                  id: "clipboard",
                  label: "Clipboard",
                  count: clipboardCount,
                  icon: <ClipboardList className="w-4 h-4" />,
                },
                {
                  id: "screen",
                  label: "Screen Share",
                  count: null,
                  icon: <MonitorPlay className="w-4 h-4" />,
                },
              ].map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() =>
                      handleNavigation(() => onChangeMode(item.id))
                    }
                    isActive={activeMode === item.id}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeMode === item.id
                        ? "bg-red-500 hover:bg-red-600 text-white font-semibold shadow-sm"
                        : "text-slate-650 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <span
                      className={
                        activeMode === item.id ? "text-white" : "text-slate-400"
                      }
                    >
                      {item.icon}
                    </span>
                    <span className="flex-grow">{item.label}</span>
                    {item.count !== null && item.count > 0 && (
                      <span
                        className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full transition-all ${
                          activeMode === item.id
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
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
          <SidebarGroupLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1 flex justify-between items-center w-full">
            <span className="flex items-center gap-1.5">
              My Rooms
              <span className="text-[9px] font-normal text-slate-400 lowercase font-sans">
                ({myRooms.length}/5 max)
              </span>
            </span>
            <div className="flex items-center space-x-1.5 text-slate-400">
              <button
                onClick={() => setShowCreateModal(true)}
                className="hover:text-slate-700 transition-colors p-0.5 cursor-pointer"
                title="Create Standard Room"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onOpenJoinModal}
                className="hover:text-slate-700 transition-colors p-0.5 cursor-pointer"
                title="Join Room Manually"
              >
                <KeyRound className="w-3.5 h-3.5" />
              </button>
            </div>
          </SidebarGroupLabel>

          <SidebarGroupContent className="space-y-2">
            <SidebarMenu className="space-y-1">
              {myRooms.map((r) => {
                const isRoomRemote =
                  r.is_remote || (typeof r.id === "string" && r.id.startsWith("remote-"));
                return (
                  <SidebarMenuItem
                    key={r.id}
                    className="group/item relative flex items-center justify-between rounded-xl hover:bg-slate-100 transition-all"
                  >
                    <SidebarMenuButton
                      onClick={() => handleNavigation(() => setRoomId(r.id))}
                      isActive={currentRoomId === r.id}
                      className={`flex-grow text-left px-2.5 py-2 text-xs truncate flex items-center gap-2 cursor-pointer transition-colors ${
                        currentRoomId === r.id
                          ? "bg-slate-100 text-slate-900 font-semibold rounded-xl"
                          : "text-slate-655 hover:text-slate-900"
                      }`}
                    >
                      {isRoomRemote ? (
                        <Globe className="w-3.5 h-3.5 text-indigo-500 shrink-0" title="Remote Internet Room" />
                      ) : (
                        <Wifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" title="Local WiFi Room" />
                      )}
                      <span className="truncate flex-1 pr-12">
                        {r.name || "stash:default"}
                      </span>
                    </SidebarMenuButton>

                    <div className="absolute right-1.5 flex items-center space-x-1 shrink-0 opacity-100 md:opacity-0 md:group-hover/item:opacity-100 transition-opacity pl-2 py-0.5 rounded-r-xl bg-transparent">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenShareForRoom(r.id);
                        }}
                        className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
                        title="Share & Security"
                      >
                        <Share2 className="w-3 h-3" />
                      </button>
                      {r.creator_socket_id !== "system" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteRoom(r.id);
                          }}
                          className="p-1 hover:bg-red-50 rounded-md text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                          title="Delete Room"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </SidebarMenuItem>
                );
              })}
              {myRooms.length === 0 && (
                <li className="px-2.5 py-1 text-[11px] text-slate-450">
                  No rooms created yet.
                </li>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Joined Rooms Section */}
        {joinedRooms.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
              Joined Rooms
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {joinedRooms.map((r) => {
                  const isRoomRemote =
                    r.is_remote || (typeof r.id === "string" && r.id.startsWith("remote-"));
                  return (
                    <SidebarMenuItem
                      key={r.id}
                      className="group/item relative flex items-center justify-between rounded-xl hover:bg-slate-100 transition-all"
                    >
                      <SidebarMenuButton
                        onClick={() => handleNavigation(() => setRoomId(r.id))}
                        isActive={currentRoomId === r.id}
                        className={`flex-grow text-left px-2.5 py-2 text-xs truncate flex items-center gap-2 cursor-pointer transition-colors ${
                          currentRoomId === r.id
                            ? "bg-slate-100 text-slate-900 font-semibold rounded-xl"
                            : "text-slate-655 hover:text-slate-900"
                        }`}
                      >
                        {isRoomRemote ? (
                          <Globe className="w-3.5 h-3.5 text-indigo-500 shrink-0" title="Remote Internet Room" />
                        ) : (
                          <Wifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" title="Local WiFi Room" />
                        )}
                        <span className="truncate flex-1 pr-12">
                          {r.name || r.id}
                        </span>
                      </SidebarMenuButton>

                      <div className="absolute right-1.5 flex items-center space-x-1 shrink-0 opacity-100 md:opacity-0 md:group-hover/item:opacity-100 transition-opacity pl-2 py-0.5 rounded-r-xl bg-transparent">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenShareForRoom(r.id);
                          }}
                          className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
                          title="Share & Security"
                        >
                          <Share2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            leaveRoom(r.id);
                          }}
                          className="p-1 hover:bg-red-50 rounded-md text-slate-400 hover:text-yellow-600 transition-colors cursor-pointer"
                          title="Leave Room"
                        >
                          <LogOut className="w-3 h-3" />
                        </button>
                      </div>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* 1. Create Standard Room Modal */}
      <Dialog
        open={showCreateModal}
        onOpenChange={(open) => {
          if (!isSubmitting) setShowCreateModal(open);
        }}
      >
        <DialogContent className="bg-white border-slate-200 text-slate-900">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900">
              Create New Room
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Setup a custom workspace name, description, ID, and security
              configuration.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleCreateRoomSubmit}
            className="space-y-4 text-xs text-slate-750"
          >
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Room Name *
              </label>
              <Input
                type="text"
                autoFocus
                placeholder="e.g. My Shared Space"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="bg-white border-slate-200 text-slate-800 text-xs focus:ring-red-500 focus:border-red-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Description
              </label>
              <Textarea
                rows={2}
                placeholder="Optional brief description"
                value={roomDescription}
                onChange={(e) => setRoomDescription(e.target.value)}
                className="bg-white border-slate-200 text-slate-800 text-xs focus:ring-red-500 focus:border-red-500 resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Custom Room ID
              </label>
              <Input
                type="text"
                placeholder="Leave empty for auto-generated ID"
                value={customRoomId}
                onChange={(e) => setCustomRoomId(e.target.value)}
                className="bg-white border-slate-200 text-slate-800 text-xs focus:ring-red-500 focus:border-red-500 font-mono"
              />
            </div>

            <div className="border-t border-slate-200 pt-3 space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Security Settings
              </span>

              <div className="flex items-center justify-between border border-slate-100 bg-slate-55/60 p-2.5 rounded-xl">
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-800">
                    Private Room
                  </span>
                  <span className="text-[9px] text-slate-500">
                    Require guests to input a passcode pin to enter
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isProtected}
                  onChange={(e) => setIsProtected(e.target.checked)}
                  className="w-4 h-4 accent-red-500 rounded cursor-pointer"
                />
              </div>

              {isProtected && (
                <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 text-left animate-slideDown">
                  <label className="text-[10px] text-slate-450 font-bold uppercase tracking-wider block">
                    Custom Access Pin / Passcode
                  </label>
                  <Input
                    type="text"
                    maxLength={12}
                    placeholder="e.g. MYPIN1 (optional, auto-generated if blank)"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="bg-white border-slate-200 text-slate-805 text-xs focus:ring-red-500 focus:border-red-500 uppercase font-mono tracking-widest text-center"
                  />
                </div>
              )}

              <div className="flex items-center justify-between border border-slate-100 bg-slate-55/60 p-2.5 rounded-xl">
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-800">
                    Manual Host Approval
                  </span>
                  <span className="text-[9px] text-slate-500">
                    Host must approve each guest join request manually
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={acceptOnly}
                  onChange={(e) => setAcceptOnly(e.target.checked)}
                  className="w-4 h-4 accent-red-500 rounded cursor-pointer"
                />
              </div>
            </div>

            <DialogFooter className="flex justify-end space-x-3 pt-2 border-t border-slate-200">
              <Button
                type="button"
                variant="secondary"
                disabled={isSubmitting}
                onClick={() => setShowCreateModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !roomName.trim()}
                className="bg-red-500 hover:bg-red-600 text-white text-xs font-semibold cursor-pointer min-w-[120px]"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </span>
                ) : (
                  "Create Room"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Create Remote Room Modal (Over-the-Internet Encrypted Room) */}
      <Dialog
        open={showRemoteCreateModal}
        onOpenChange={(open) => {
          if (!isSubmittingRemote) setShowRemoteCreateModal(open);
        }}
      >
        <DialogContent className="bg-white border-slate-200 text-slate-900">
          <DialogHeader>
            <div className="flex items-center gap-2 text-indigo-600">
              <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-100">
                <Globe className="w-4 h-4 text-indigo-600" />
              </div>
              <DialogTitle className="text-sm font-bold text-slate-900">
                Create Remote Room (Internet)
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 text-left">
              Create an encrypted room accessible across different WiFi networks over the internet. A password is required to secure your room.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleCreateRemoteRoomSubmit}
            className="space-y-4 text-xs text-slate-750"
          >
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Remote Room Name *
              </label>
              <Input
                type="text"
                autoFocus
                placeholder="e.g. Global Project Sync"
                value={remoteName}
                onChange={(e) => setRemoteName(e.target.value)}
                className="bg-white border-slate-200 text-slate-800 text-xs focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Room Password * (Required for Remote)
                </label>
                <button
                  type="button"
                  onClick={generateRandomRemotePassword}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  Auto-Generate
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showRemotePassword ? "text" : "password"}
                  placeholder="Enter strong password / passcode"
                  value={remotePassword}
                  onChange={(e) => setRemotePassword(e.target.value)}
                  className="bg-white border-slate-200 text-slate-800 text-xs pr-10 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowRemotePassword(!showRemotePassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
                >
                  {showRemotePassword ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <p className="text-[9px] text-slate-450 text-left">
                Users over the internet will need this password to authenticate and join.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Custom Remote Room ID (Optional)
              </label>
              <Input
                type="text"
                placeholder="e.g. project-team-2026 (auto-prefixed with remote-)"
                value={remoteCustomId}
                onChange={(e) => setRemoteCustomId(e.target.value)}
                className="bg-white border-slate-200 text-slate-800 text-xs focus:ring-indigo-500 focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Description (Optional)
              </label>
              <Textarea
                rows={2}
                placeholder="Brief description for remote collaborators"
                value={remoteDescription}
                onChange={(e) => setRemoteDescription(e.target.value)}
                className="bg-white border-slate-200 text-slate-800 text-xs focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-2 text-left">
              <Shield className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-[10px] text-indigo-900 leading-tight">
                <span className="font-bold">Over-the-Internet Security:</span> P2P WebRTC data channels with Multi-STUN NAT traversal and encrypted HMAC authentication tokens.
              </div>
            </div>

            <DialogFooter className="flex justify-end space-x-3 pt-2 border-t border-slate-200">
              <Button
                type="button"
                variant="secondary"
                disabled={isSubmittingRemote}
                onClick={() => setShowRemoteCreateModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingRemote || !remoteName.trim() || !remotePassword.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer min-w-[140px]"
              >
                {isSubmittingRemote ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating Remote...
                  </span>
                ) : (
                  "Create Remote Room"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 3. Join Remote Room Modal */}
      <Dialog open={showRemoteJoinModal} onOpenChange={setShowRemoteJoinModal}>
        <DialogContent className="bg-white border-slate-200 text-slate-900">
          <DialogHeader>
            <div className="flex items-center gap-2 text-indigo-600">
              <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-100">
                <KeyRound className="w-4 h-4 text-indigo-600" />
              </div>
              <DialogTitle className="text-sm font-bold text-slate-900">
                Join Remote Room (Internet)
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 text-left">
              Enter the Room ID and Password to connect with remote peers over the internet.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleJoinRemoteSubmit}
            className="space-y-4 text-xs text-slate-750"
          >
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Remote Room ID *
              </label>
              <Input
                type="text"
                autoFocus
                placeholder="e.g. remote-a1b2c3 or custom room ID"
                value={joinRemoteId}
                onChange={(e) => setJoinRemoteId(e.target.value)}
                className="bg-white border-slate-200 text-slate-800 text-xs focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Room Password *
              </label>
              <div className="relative">
                <Input
                  type={showJoinRemotePass ? "text" : "password"}
                  placeholder="Enter room password / passcode"
                  value={joinRemotePass}
                  onChange={(e) => setJoinRemotePass(e.target.value)}
                  className="bg-white border-slate-200 text-slate-800 text-xs pr-10 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowJoinRemotePass(!showJoinRemotePass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
                >
                  {showJoinRemotePass ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <DialogFooter className="flex justify-end space-x-3 pt-2 border-t border-slate-200">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowRemoteJoinModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isJoiningRemote || !joinRemoteId.trim() || !joinRemotePass.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
              >
                {isJoiningRemote ? "Connecting..." : "Join Remote Room"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ShadcnSidebar>
  );
}
