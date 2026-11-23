import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function commFetch(endpoint, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = {
    ...(options.headers || {}),
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
  };
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Gagal memuat data komunitas.');
  return data;
}

// Gabungkan pesan dari database dengan pesan lokal yang baru terkirim agar tidak pernah hilang
function mergeMessages(prevMessages, serverMessages) {
  if (!Array.isArray(serverMessages)) return prevMessages;
  const serverIds = new Set(serverMessages.map((m) => m.id));
  const unsyncedLocal = prevMessages.filter(
    (m) => String(m.id).startsWith('temp-') || (!serverIds.has(m.id) && m._justSent)
  );
  return [...serverMessages, ...unsyncedLocal];
}

export default function CommunityHub({
  currentUser,
  hotspots = [],
  onSelectHotspotOnMap,
  onToast
}) {
  const [sidebarTab, setSidebarTab] = useState('groups'); // 'groups' | 'volunteers'
  const [groups, setGroups] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Room aktif: { type: 'group' | 'dm', id, data }
  const [activeRoom, setActiveRoom] = useState(null);
  const [groupDetails, setGroupDetails] = useState({ group: null, members: [], messages: [] });
  const [dmMessages, setDmMessages] = useState([]);
  const [showMembersDrawer, setShowMembersDrawer] = useState(false);

  // Input pesan & lokasi
  const [messageText, setMessageText] = useState('');
  const [selectedHotspotId, setSelectedHotspotId] = useState('');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [sending, setSending] = useState(false);

  // Modal buat grup, profil & undang
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [inspectVolunteer, setInspectVolunteer] = useState(null);
  const [inviteTargetVol, setInviteTargetVol] = useState(null);
  const [inviteGroupId, setInviteGroupId] = useState('');

  const chatBottomRef = useRef(null);

  const loadCommunity = async () => {
    try {
      const res = await commFetch('/volunteer/community');
      setGroups(res.groups || []);
      setVolunteers(res.volunteers || []);
      setInvitations(res.invitations || []);
    } catch (err) {
      if (onToast) onToast(err.message);
    }
  };

  useEffect(() => {
    loadCommunity();
  }, []);

  const loadRoomMessages = async (room) => {
    if (!room) return;
    try {
      if (room.type === 'group') {
        const res = await commFetch(`/volunteer/groups/${room.id}/details`);
        setGroupDetails((prev) => ({
          group: res.group || prev.group,
          members: res.members || prev.members,
          messages: mergeMessages(prev.messages, res.messages || [])
        }));
      } else if (room.type === 'dm') {
        const res = await commFetch(`/volunteer/dm/${room.id}`);
        setDmMessages((prev) => mergeMessages(prev, res.messages || []));
      }
    } catch (err) {
      console.warn('Polling chat:', err.message);
    }
  };

  useEffect(() => {
    if (!activeRoom) return;
    // Reset daftar pesan saat berpindah ke room berbeda
    setGroupDetails({ group: null, members: [], messages: [] });
    setDmMessages([]);
    loadRoomMessages(activeRoom);

    const interval = setInterval(() => loadRoomMessages(activeRoom), 3500);
    return () => clearInterval(interval);
  }, [activeRoom?.type, activeRoom?.id]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [groupDetails.messages.length, dmMessages.length]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      const res = await commFetch('/volunteer/groups', {
        method: 'POST',
        body: JSON.stringify({ name: newGroupName, description: newGroupDesc })
      });
      setNewGroupName('');
      setNewGroupDesc('');
      setShowCreateGroup(false);
      await loadCommunity();
      if (res.group) {
        setActiveRoom({ type: 'group', id: res.group.id, data: res.group });
      }
    } catch (err) {
      if (onToast) onToast(err.message);
    }
  };

  const handleJoinGroup = async (group) => {
    try {
      await commFetch(`/volunteer/groups/${group.id}/join`, { method: 'POST' });
      await loadCommunity();
      setActiveRoom({ type: 'group', id: group.id, data: { ...group, is_member: true } });
    } catch (err) {
      if (onToast) onToast(err.message);
    }
  };

  const handleRespondInvitation = async (invitationId, action) => {
    try {
      await commFetch(`/volunteer/invitations/${invitationId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      await loadCommunity();
    } catch (err) {
      if (onToast) onToast(err.message);
    }
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteGroupId || !inviteTargetVol) return;
    try {
      const res = await commFetch(`/volunteer/groups/${inviteGroupId}/invite`, {
        method: 'POST',
        body: JSON.stringify({ invitee_id: inviteTargetVol.id })
      });
      setInviteTargetVol(null);
      setInviteGroupId('');
      if (onToast) onToast(res.message);
    } catch (err) {
      if (onToast) onToast(err.message);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!activeRoom || (!messageText.trim() && !selectedHotspotId)) return;

    const textToSend = messageText.trim();
    const hotspotIdToSend = selectedHotspotId || null;
    const attachedZone = hotspots.find((h) => h.id === hotspotIdToSend) || null;

    // 1. Tampilkan pesan secara instan di ruang chat
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      sender_id: currentUser?.id,
      content: textToSend,
      hotspot_id: hotspotIdToSend,
      hotspots: attachedZone,
      profiles: { full_name: currentUser?.full_name || 'Anda' },
      created_at: new Date().toISOString(),
      _justSent: true
    };

    if (activeRoom.type === 'group') {
      setGroupDetails((prev) => ({
        ...prev,
        messages: [...prev.messages, optimisticMsg]
      }));
    } else {
      setDmMessages((prev) => [...prev, optimisticMsg]);
    }

    setMessageText('');
    setSelectedHotspotId('');
    setShowLocationPicker(false);

    try {
      setSending(true);
      const endpoint =
        activeRoom.type === 'group'
          ? `/volunteer/groups/${activeRoom.id}/messages`
          : `/volunteer/dm/${activeRoom.id}`;

      const res = await commFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          content: textToSend,
          hotspot_id: hotspotIdToSend
        })
      });

      // 2. Ganti pesan sementara dengan objek asli dari server (tandai _justSent agar bertahan di UI)
      if (res?.message) {
        const savedMsg = { ...res.message, _justSent: true };
        if (activeRoom.type === 'group') {
          setGroupDetails((prev) => ({
            ...prev,
            messages: prev.messages.map((m) => (m.id === tempId ? savedMsg : m))
          }));
        } else {
          setDmMessages((prev) => prev.map((m) => (m.id === tempId ? savedMsg : m)));
        }
      }
    } catch (err) {
      if (activeRoom.type === 'group') {
        setGroupDetails((prev) => ({
          ...prev,
          messages: prev.messages.filter((m) => m.id !== tempId)
        }));
      } else {
        setDmMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
      setMessageText(textToSend);
      if (onToast) onToast(`Gagal mengirim pesan: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const myJoinedGroups = groups.filter((g) => g.is_member);
  const filteredGroups = groups.filter((g) =>
    g.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredVolunteers = volunteers.filter((v) =>
    v.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeMessages = activeRoom?.type === 'group' ? groupDetails.messages : dmMessages;
  const attachedHotspot = hotspots.find((h) => h.id === selectedHotspotId);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(270px, 310px) 1fr',
        height: '600px',
        background: '#fff',
        border: '1px solid #cbd5e1',
        borderRadius: '12px',
        overflow: 'hidden'
      }}
    >
      {/* ==================== SIDEBAR KIRI ==================== */}
      <div style={{ borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden' }}>
        <div style={{ padding: '12px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <strong style={{ fontSize: '0.96rem', color: '#0f172a' }}>Komunitas</strong>
            <button
              type="button"
              onClick={() => setShowCreateGroup((prev) => !prev)}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: 'none',
                background: '#0f766e',
                color: '#fff',
                fontWeight: '700',
                fontSize: '0.76rem',
                cursor: 'pointer'
              }}
            >
              + Grup
            </button>
          </div>

          {showCreateGroup && (
            <form onSubmit={handleCreateGroup} style={{ background: '#f0fdfa', padding: '8px', borderRadius: '8px', border: '1px solid #99f6e4', marginBottom: '8px', display: 'grid', gap: '6px' }}>
              <input
                type="text"
                required
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Nama Grup Baru"
                style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              />
              <input
                type="text"
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
                placeholder="Deskripsi singkat"
                style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              />
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowCreateGroup(false)} style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Batal</button>
                <button type="submit" style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px', border: 'none', background: '#0f766e', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>Buat</button>
              </div>
            </form>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px', marginBottom: '8px' }}>
            <button
              type="button"
              onClick={() => setSidebarTab('groups')}
              style={{
                padding: '6px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: '700',
                cursor: 'pointer',
                background: sidebarTab === 'groups' ? '#fff' : 'transparent',
                color: sidebarTab === 'groups' ? '#0f766e' : '#64748b'
              }}
            >
              Grup ({groups.length})
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('volunteers')}
              style={{
                padding: '6px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: '700',
                cursor: 'pointer',
                background: sidebarTab === 'volunteers' ? '#fff' : 'transparent',
                color: sidebarTab === 'volunteers' ? '#0f766e' : '#64748b'
              }}
            >
              Relawan ({volunteers.length})
            </button>
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={sidebarTab === 'groups' ? 'Cari grup...' : 'Cari relawan...'}
            style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
          />
        </div>

        {/* Undangan Masuk ke Grup */}
        {invitations.length > 0 && (
          <div style={{ padding: '8px 12px', background: '#fefce8', borderBottom: '1px solid #fde047' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: '700', color: '#854d0e', marginBottom: '4px' }}>
              Undangan Grup ({invitations.length})
            </div>
            {invitations.map((inv) => (
              <div key={inv.id} style={{ background: '#fff', padding: '7px', borderRadius: '6px', border: '1px solid #fde68a', marginBottom: '4px', fontSize: '0.77rem' }}>
                <div>
                  <strong>{inv.profiles?.full_name}</strong> mengundang ke <strong>{inv.collaboration_groups?.name}</strong>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '5px' }}>
                  <button type="button" onClick={() => handleRespondInvitation(inv.id, 'accept')} style={{ flex: 1, padding: '3px', borderRadius: '4px', border: 'none', background: '#0f766e', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>Terima</button>
                  <button type="button" onClick={() => handleRespondInvitation(inv.id, 'decline')} style={{ flex: 1, padding: '3px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', color: '#64748b', cursor: 'pointer' }}>Tolak</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Daftar Grup / Relawan */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sidebarTab === 'groups' ? (
            filteredGroups.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: '0.82rem', color: '#64748b' }}>
                Belum ada grup.
              </div>
            ) : (
              filteredGroups.map((g) => {
                const isSelected = activeRoom?.type === 'group' && activeRoom?.id === g.id;
                return (
                  <div
                    key={g.id}
                    onClick={() => {
                      setShowMembersDrawer(false);
                      setActiveRoom({ type: 'group', id: g.id, data: g });
                    }}
                    style={{
                      padding: '11px 14px',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      background: isSelected ? '#e6fffa' : '#fff',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: '700', fontSize: '0.88rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        # {g.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {g.description || 'Obrolan grup relawan'}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', flexShrink: 0 }}>{g.member_count}</span>
                  </div>
                );
              })
            )
          ) : (
            filteredVolunteers.map((v) => {
              const isSelected = activeRoom?.type === 'dm' && activeRoom?.id === v.id;
              return (
                <div
                  key={v.id}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid #f1f5f9',
                    background: isSelected ? '#e6fffa' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px'
                  }}
                >
                  <div
                    onClick={() => setActiveRoom({ type: 'dm', id: v.id, data: v })}
                    style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                  >
                    <div style={{ fontWeight: '700', fontSize: '0.86rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {v.full_name}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      {v.volunteer_level || 'Pemula'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => setInspectVolunteer(v)}
                      style={{ padding: '4px 7px', borderRadius: '5px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.73rem', cursor: 'pointer' }}
                    >
                      Profil
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInviteTargetVol(v);
                        setInviteGroupId(myJoinedGroups[0]?.id || '');
                      }}
                      style={{ padding: '4px 7px', borderRadius: '5px', border: '1px solid #0f766e', background: '#f0fdfa', color: '#0f766e', fontSize: '0.73rem', fontWeight: '700', cursor: 'pointer' }}
                    >
                      + Grup
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ==================== AREA CHAT SEDERHANA & BERSIH ==================== */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', overflow: 'hidden' }}>
        {!activeRoom ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontWeight: '700', fontSize: '1rem', color: '#0f172a', marginBottom: '4px' }}>
              Pilih Grup atau Relawan
            </div>
            <p style={{ margin: 0, maxWidth: '340px', fontSize: '0.84rem' }}>
              Klik nama grup atau relawan di sebelah kiri untuk mulai mengobrol dan membagikan lokasi pembersihan bersama.
            </p>
          </div>
        ) : (
          <>
            {/* Header Room */}
            <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#0f172a' }}>
                  {activeRoom.type === 'group' ? `# ${activeRoom.data.name}` : activeRoom.data.full_name}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {activeRoom.type === 'group'
                    ? `${groupDetails.members.length} anggota`
                    : `${activeRoom.data.volunteer_level || 'Pemula'} · ${activeRoom.data.completed_tasks_count || 0} tugas selesai`}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                {activeRoom.type === 'group' ? (
                  <button
                    type="button"
                    onClick={() => setShowMembersDrawer((prev) => !prev)}
                    style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: showMembersDrawer ? '#0f766e' : '#fff', color: showMembersDrawer ? '#fff' : '#334155', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Anggota ({groupDetails.members.length})
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setInspectVolunteer(activeRoom.data)}
                      style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer' }}
                    >
                      Profil
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInviteTargetVol(activeRoom.data);
                        setInviteGroupId(myJoinedGroups[0]?.id || '');
                      }}
                      style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', background: '#0f766e', color: '#fff', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer' }}
                    >
                      + Undang Grup
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Daftar Anggota Grup */}
            {activeRoom.type === 'group' && showMembersDrawer && (
              <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '10px 16px', maxHeight: '150px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {groupDetails.members.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setInspectVolunteer(m)}
                      style={{ padding: '4px 10px', borderRadius: '99px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.78rem', cursor: 'pointer', color: '#0f172a' }}
                    >
                      {m.full_name} {m.group_role === 'leader' ? '(Ketua)' : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Daftar Pesan Format Sederhana (username : "pesan" / location) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeMessages.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '0.84rem', marginTop: '12px' }}>
                  Belum ada pesan di obrolan ini. Ketik pesan di bawah untuk memulai.
                </div>
              ) : (
                activeMessages.map((m) => {
                  const isMine = m.sender_id === currentUser?.id;
                  const senderName = isMine
                    ? (currentUser?.full_name || 'Anda')
                    : (m.profiles?.full_name || activeRoom.data?.full_name || 'Relawan');

                  return (
                    <div
                      key={m.id}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: isMine ? '#f8fafc' : 'transparent',
                        fontSize: '0.9rem',
                        lineHeight: '1.5',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        gap: '12px'
                      }}
                    >
                      <div style={{ wordBreak: 'break-word' }}>
                        <strong style={{ color: isMine ? '#0f766e' : '#0f172a' }}>
                          {senderName}
                        </strong>
                        <span style={{ color: '#64748b', margin: '0 6px' }}>:</span>

                        {m.content && (
                          <span style={{ color: '#1e293b' }}>
                            &ldquo;{m.content}&rdquo;
                          </span>
                        )}

                        {m.hotspots && (
                          <span style={{ marginLeft: m.content ? '8px' : 0 }}>
                            <button
                              type="button"
                              onClick={() => onSelectHotspotOnMap && onSelectHotspotOnMap(m.hotspots)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                border: '1px solid #0f766e',
                                background: '#f0fdfa',
                                color: '#0f766e',
                                fontWeight: '700',
                                fontSize: '0.8rem',
                                cursor: 'pointer'
                              }}
                            >
                              📍 {m.hotspots.title} ({m.hotspots.priority_level?.toUpperCase()}) ↗
                            </button>
                          </span>
                        )}
                      </div>

                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', flexShrink: 0 }}>
                        {new Date(m.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Pemilih Lokasi Kerja Bareng */}
            {showLocationPicker && (
              <div style={{ padding: '8px 14px', background: '#f0fdfa', borderTop: '1px solid #99f6e4', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={selectedHotspotId}
                  onChange={(e) => setSelectedHotspotId(e.target.value)}
                  style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #0f766e', fontSize: '0.83rem', background: '#fff' }}
                >
                  <option value="">-- Pilih Titik Lokasi Sampah --</option>
                  {hotspots.map((hs) => (
                    <option key={hs.id} value={hs.id}>
                      {hs.title} ({hs.priority_level?.toUpperCase()})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHotspotId('');
                    setShowLocationPicker(false);
                  }}
                  style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.78rem', cursor: 'pointer' }}
                >
                  Batal
                </button>
              </div>
            )}

            {/* Bar Input Pesan */}
            {activeRoom.type === 'group' && !activeRoom.data.is_member ? (
              <div style={{ padding: '12px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.84rem', color: '#475569' }}>
                  Gabung grup ini untuk mulai mengirim pesan & lokasi.
                </span>
                <button
                  type="button"
                  onClick={() => handleJoinGroup(activeRoom.data)}
                  style={{ padding: '7px 14px', borderRadius: '6px', border: 'none', background: '#0f766e', color: '#fff', fontWeight: '700', cursor: 'pointer' }}
                >
                  Gabung Grup
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} style={{ padding: '10px 14px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setShowLocationPicker((prev) => !prev)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #0f766e',
                    background: selectedHotspotId ? '#0f766e' : '#fff',
                    color: selectedHotspotId ? '#fff' : '#0f766e',
                    fontWeight: '700',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  📍 {attachedHotspot ? attachedHotspot.title.slice(0, 14) : 'Lokasi'}
                </button>

                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Ketik pesan..."
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', background: '#fff' }}
                />

                <button
                  type="submit"
                  disabled={sending || (!messageText.trim() && !selectedHotspotId)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    background: (!messageText.trim() && !selectedHotspotId) ? '#94a3b8' : '#0f766e',
                    color: '#fff',
                    fontWeight: '700',
                    cursor: (!messageText.trim() && !selectedHotspotId) ? 'not-allowed' : 'pointer'
                  }}
                >
                  Kirim
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {/* ==================== MODAL PROFIL RELAWAN ==================== */}
      {inspectVolunteer && (
        <div
          onClick={() => setInspectVolunteer(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '12px', padding: '20px', width: '100%', maxWidth: '380px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Profil Sukarelawan</h3>
              <button onClick={() => setInspectVolunteer(null)} style={{ background: '#e2e8f0', border: 'none', borderRadius: '6px', padding: '4px 9px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gap: '8px', fontSize: '0.88rem', color: '#334155' }}>
              <div><strong>Nama:</strong> {inspectVolunteer.full_name}</div>
              <div><strong>Level:</strong> {inspectVolunteer.volunteer_level || 'Pemula'} ({inspectVolunteer.experience_points || 0} XP)</div>
              <div><strong>Tugas Selesai:</strong> {inspectVolunteer.completed_tasks_count || 0} Lokasi</div>
              {inspectVolunteer.age && <div><strong>Umur:</strong> {inspectVolunteer.age} Tahun</div>}
              {inspectVolunteer.phone && <div><strong>Kontak / WA:</strong> {inspectVolunteer.phone}</div>}
            </div>
            {inspectVolunteer.id !== currentUser?.id && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const target = inspectVolunteer;
                    setInspectVolunteer(null);
                    setActiveRoom({ type: 'dm', id: target.id, data: target });
                  }}
                  style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: '#0f766e', color: '#fff', fontWeight: '700', cursor: 'pointer' }}
                >
                  Chat Langsung
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = inspectVolunteer;
                    setInspectVolunteer(null);
                    setInviteTargetVol(target);
                    setInviteGroupId(myJoinedGroups[0]?.id || '');
                  }}
                  style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #0f766e', background: '#f0fdfa', color: '#0f766e', fontWeight: '700', cursor: 'pointer' }}
                >
                  + Undang Grup
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== MODAL UNDANG KE GRUP ==================== */}
      {inviteTargetVol && (
        <div
          onClick={() => setInviteTargetVol(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <form
            onSubmit={handleSendInvite}
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '12px', padding: '20px', width: '100%', maxWidth: '380px' }}
          >
            <h3 style={{ margin: '0 0 6px 0' }}>Undang ke Grup</h3>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.84rem', color: '#64748b' }}>
              Undang <strong>{inviteTargetVol.full_name}</strong> bergabung ke grup:
            </p>
            {myJoinedGroups.length === 0 ? (
              <p style={{ fontSize: '0.84rem', color: '#b91c1c' }}>
                Anda belum tergabung di grup mana pun. Buat grup terlebih dahulu.
              </p>
            ) : (
              <select
                required
                value={inviteGroupId}
                onChange={(e) => setInviteGroupId(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '12px' }}
              >
                {myJoinedGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setInviteTargetVol(null)} style={{ padding: '7px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Batal</button>
              {myJoinedGroups.length > 0 && (
                <button type="submit" style={{ padding: '7px 14px', borderRadius: '6px', border: 'none', background: '#0f766e', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>
                  Kirim Undangan
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}