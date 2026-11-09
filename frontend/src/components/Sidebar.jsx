import { useState } from "react";
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
  onOpenShareForRoom,
}) {
  const { isMobile, setOpenMobile } = useSidebar();

  // Create Room Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [customRoomId, setCustomRoomId] = useState("");
  const [isProtected, setIsProtected] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [acceptOnly, setAcceptOnly] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        // Reset form fields
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
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ShadcnSidebar className="border-r border-slate-200 bg-white select-none text-slate-800">
      <SidebarHeader className="p-4 border-b border-slate-200/50">
        {/* The same lockup the marketing page uses: lowercase mono "stash"
            with a square chip, not a Title Case wordmark with a round avatar.
            It is also a real link home — the product had no route back. */}
        <div className="flex items-center justify-between gap-2">
          <a
            href="/"
            className="group/mark flex items-center gap-2 font-mono text-sm font-semibold text-slate-900 min-h-7"
            aria-label="Stash, home"
          >
            <span
              aria-hidden="true"
              className="w-2.5 h-2.5 shrink-0 rounded-[3px] border-2 border-slate-900 bg-danger-500 transition-[rotate,background-color] duration-300 group-hover/mark:rotate-45 group-hover/mark:bg-red-500 group-focus-visible/mark:rotate-45"
            />
            stash
          </a>
          <button
            type="button"
            onClick={() => handleNavigation(fetchDefaultRoom)}
            className="font-mono text-[11px] text-slate-500 hover:text-slate-900 underline underline-offset-2 min-h-7 px-1 cursor-pointer"
          >
            Default room
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4 space-y-6">
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
                    /* The active item needs its own hover: without one it was
                       the only primary target on the page that did not react
                       to the pointer. It lifts, like the landing page's keys. */
                    className={`w-full text-left px-2.5 py-2 rounded-[10px] text-xs flex items-center gap-2.5 cursor-pointer border-2 transition-[background-color,color,translate,box-shadow] duration-150 ${
                      activeMode === item.id
                        ? "bg-red-500 text-white font-semibold border-slate-900 shadow-[2px_2px_0_0_var(--color-slate-900)] hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_var(--color-slate-900)]"
                        : "text-slate-600 border-transparent hover:bg-white hover:text-slate-900 hover:border-slate-900"
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
                className="hover:text-slate-900 hover:bg-white hover:border-slate-900 border-2 border-transparent transition-colors p-1 min-w-8 min-h-8 inline-flex items-center justify-center rounded-[8px] cursor-pointer"
                aria-label="Create Room" title="Create Room"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onOpenJoinModal}
                className="hover:text-slate-900 hover:bg-white hover:border-slate-900 border-2 border-transparent transition-colors p-1 min-w-8 min-h-8 inline-flex items-center justify-center rounded-[8px] cursor-pointer"
                aria-label="Join Room Manually" title="Join Room Manually"
              >
                <KeyRound className="w-3.5 h-3.5" />
              </button>
            </div>
          </SidebarGroupLabel>

          <SidebarGroupContent className="space-y-2">
            <SidebarMenu className="space-y-1">
              {myRooms.map((r) => (
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
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
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
                      className="p-1.5 min-w-7 min-h-7 inline-flex items-center justify-center hover:bg-slate-200 rounded-md text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
                      aria-label="Share & Security" title="Share & Security"
                    >
                      <Share2 className="w-3 h-3" />
                    </button>
                    {/* "My rooms" are rooms this browser created, so we hold a
                        host token for them. The server re-checks it anyway. */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteRoom(r.id);
                      }}
                      className="p-1.5 min-w-7 min-h-7 inline-flex items-center justify-center hover:bg-red-50 rounded-md text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                      aria-label="Delete Room" title="Delete Room"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </SidebarMenuItem>
              ))}
              {myRooms.length === 0 && (
                <li className="px-2.5 py-1 text-[11px] text-slate-400">
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
                {joinedRooms.map((r) => (
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
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
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
                        className="p-1.5 min-w-7 min-h-7 inline-flex items-center justify-center hover:bg-slate-200 rounded-md text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
                        aria-label="Share & Security" title="Share & Security"
                      >
                        <Share2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          leaveRoom(r.id);
                        }}
                        className="p-1.5 min-w-7 min-h-7 inline-flex items-center justify-center hover:bg-red-50 rounded-md text-slate-400 hover:text-yellow-600 transition-colors cursor-pointer"
                        aria-label="Leave Room" title="Leave Room"
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

      {/* Create Room Modal */}
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
            className="space-y-4 text-xs text-slate-700"
          >
            {/* Room Name */}
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

            {/* Room Description */}
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

            {/* Custom Room ID */}
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

            {/* Security Settings */}
            <div className="border-t border-slate-200 pt-3 space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Security Settings
              </span>

              {/* Private Checkbox */}
              <div className="flex items-center justify-between border border-slate-100 bg-slate-50/60 p-2.5 rounded-xl">
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

              {/* Password field shown if private is checked */}
              {isProtected && (
                <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 text-left animate-slideDown">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Custom Access Pin / Passcode
                  </label>
                  <Input
                    type="text"
                    maxLength={12}
                    placeholder="e.g. MYPIN1 (optional, auto-generated if blank)"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="bg-white border-slate-200 text-slate-800 text-xs focus:ring-red-500 focus:border-red-500 uppercase font-mono tracking-widest text-center"
                  />
                </div>
              )}

              {/* Manual approval Checkbox */}
              <div className="flex items-center justify-between border border-slate-100 bg-slate-50/60 p-2.5 rounded-xl">
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
    </ShadcnSidebar>
  );
}
