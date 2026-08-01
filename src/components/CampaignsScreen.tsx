import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, Alert, StyleSheet, Dimensions, Share, Modal
} from 'react-native';
import Svg, { Rect, Path } from 'react-native-svg';
import { SvgIcon } from './SvgIcon';
import { API_CALLS } from '../utils/api';
import { OfflineManager } from '../utils/offline';

const { width: W } = Dimensions.get('window');
const BANNER_H = 160;

export interface Campaign {
  id: number;
  title: string;
  category: string;
  status: string;
  description?: string;
  total_registrations?: number;
  start_date?: string;
  banner_url?: string;
  test_template_id?: number | null;
}

export interface CampaignsScreenProps {
  campaigns: Campaign[];
  user: any;
  searchVal: string;
  setSearchVal: (v: string) => void;
  loading: boolean;
  loadingText: string;
  handleLogout: () => void;
  loadCampaigns: (preventAutoSync?: boolean) => void;
  handleSelectCampaign: (c: Campaign) => void;
  onOpenMenu?: () => void;
  onNavigate: (screen: string) => void;
  setCampaignIdToEdit: (id: number | null) => void;
  serverUrl: string;
  token?: string;
  isOfflineMode?: boolean;
}

const CATS = ['Health Camp','Blood Donation','Vaccination','Awareness Program','Survey','Education Drive','NGO Event','Other'];

// Tiny QR placeholder (real QR needs a lib; we show a styled placeholder)
const QRPlaceholder = ({ size = 36 }: { size?: number }) => (
  <View style={{ width: size, height: size, backgroundColor: '#fff', padding: 3, borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' }}>
    <View style={{ flex: 1, backgroundColor: '#0f172a', borderRadius: 2, opacity: 0.85 }} />
  </View>
);

export const CampaignsScreen: React.FC<CampaignsScreenProps> = ({
  campaigns, user, searchVal, setSearchVal, loading, loadingText,
  handleLogout, loadCampaigns, handleSelectCampaign,
  onOpenMenu, onNavigate, setCampaignIdToEdit, serverUrl, token,
  isOfflineMode = false,
}) => {
  const [localSearch, setLocalSearch] = useState(searchVal);
  const [category, setCategory] = useState('');
  const [offlineIds, setOfflineIds] = useState<number[]>([]);

  const loadOfflineIds = async () => {
    try {
      const cached = await OfflineManager.getCachedCampaigns();
      setOfflineIds(cached.map(c => c.id));
    } catch (_) {}
  };

  useEffect(() => {
    loadOfflineIds();
  }, [campaigns]);

  const handleToggleOffline = async (camp: Campaign) => {
    const isCached = offlineIds.includes(camp.id);
    if (isCached) {
      Alert.alert('Remove Offline Campaign', `Are you sure you want to remove "${camp.title}" from local offline storage?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await OfflineManager.removeCampaignOffline(camp.id);
              Alert.alert('Success', 'Campaign cache removed successfully.');
              loadOfflineIds();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to remove offline cache.');
            }
          }
        }
      ]);
    } else {
      try {
        Alert.alert(
          'Download Campaign',
          'Download campaign configuration, questions schema, and diagnostic templates for offline use?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Download',
              onPress: async () => {
                try {
                  const offlineCamp = {
                    id: camp.id,
                    title: camp.title,
                    category: camp.category,
                    status: camp.status,
                    description: camp.description,
                    total_registrations: camp.total_registrations,
                    start_date: camp.start_date,
                    banner_url: camp.banner_url,
                    test_template_id: camp.test_template_id,
                  };
                  await OfflineManager.saveCampaignOffline(offlineCamp, serverUrl, token);
                  Alert.alert('Success', `Campaign "${camp.title}" downloaded. You can now register patients offline.`);
                  loadOfflineIds();
                } catch (err: any) {
                  Alert.alert('Download Failed', err.message || 'Check your internet connection and try again.');
                }
              }
            }
          ]
        );
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to prepare offline save.');
      }
    }
  };
  const [status, setStatus] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchVal(localSearch), 400);
    return () => clearTimeout(t);
  }, [localSearch]);

  const filtered = campaigns.filter(c => {
    const matchSearch = !searchVal || c.title.toLowerCase().includes(searchVal.toLowerCase()) || c.category.toLowerCase().includes(searchVal.toLowerCase());
    const matchCat = !category || c.category === category;
    const matchStatus = !status || c.status === status;
    return matchSearch && matchCat && matchStatus;
  });

  const handleDuplicate = async (camp: Campaign) => {
    Alert.alert('Duplicate Campaign', `Duplicate "${camp.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Duplicate', onPress: async () => {
          try {
            const res = await API_CALLS.post(`/campaigns/${camp.id}/duplicate`, {}, serverUrl, token);
            Alert.alert('Success', 'Campaign duplicated!');
            loadCampaigns();
            setCampaignIdToEdit(res.campaignId || null);
            onNavigate('CREATE_CAMPAIGN');
          } catch (e: any) { Alert.alert('Error', e.message || 'Duplication failed.'); }
        }
      }
    ]);
  };

  const handleDelete = async (camp: Campaign) => {
    Alert.alert('Delete Campaign', `Delete "${camp.title}" and ALL its submissions forever?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await API_CALLS.post(`/campaigns/${camp.id}?_method=DELETE`, {}, serverUrl, token);
            loadCampaigns();
            Alert.alert('Deleted', 'Campaign deleted successfully.');
          } catch (e: any) { Alert.alert('Error', e.message || 'Delete failed.'); }
        }
      }
    ]);
  };

  const handleShare = async (camp: Campaign) => {
    const url = `${serverUrl}/campaign/${camp.id}`;
    try {
      await Share.share({ message: `Register for ${camp.title}: ${url}`, url });
      setCopiedId(camp.id);
      setTimeout(() => setCopiedId(null), 3000);
    } catch (_) {}
  };

  const getBannerUri = (camp: Campaign) => {
    if (!camp.banner_url) return null;
    return camp.banner_url.startsWith('/') ? `${serverUrl}${camp.banner_url}` : camp.banner_url;
  };

  const statusColor = (s: string) =>
    s === 'Published' ? '#10b981' : s === 'Closed' ? '#ef4444' : '#64748b';

  return (
    <View style={s.root}>
      {/* ── Top App Bar ── */}
      <View style={s.appBar}>
        <TouchableOpacity onPress={onOpenMenu} style={s.iconBtn}>
          <SvgIcon type="menu" color="#1e293b" size={22} />
        </TouchableOpacity>
        <View style={s.searchBarWrap}>
          <SvgIcon type="search" color="#94a3b8" size={14} />
          <TextInput
            style={s.searchBarInput}
            value={localSearch}
            onChangeText={setLocalSearch}
            placeholder="Global search: campaigns, participants..."
            placeholderTextColor="#94a3b8"
          />
        </View>
        <View style={s.bellWrap}>
          <Text style={s.bellIcon}>🔔</Text>
          <View style={s.bellDot} />
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Hero Header ── */}
        <View style={s.hero}>
          <Text style={s.heroTitle}>Campaign Directory</Text>
          <Text style={s.heroSub}>Create, configure, monitor, and duplicate dynamic campaign workflows</Text>
          {user?.role === 'Admin' && (
            <TouchableOpacity style={s.createBtn} onPress={() => { setCampaignIdToEdit(null); onNavigate('CREATE_CAMPAIGN'); }}>
              <Text style={s.createBtnText}>+  Create Campaign</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Filter Panel ── */}
        <View style={s.filterPanel}>
          <View style={s.filterSearch}>
            <SvgIcon type="search" color="#94a3b8" size={15} />
            <TextInput
              style={s.filterSearchInput}
              value={localSearch}
              onChangeText={setLocalSearch}
              placeholder="Search campaigns by name, disease, or purpose..."
              placeholderTextColor="#94a3b8"
            />
          </View>
          <View style={s.filterRow}>
            <SvgIcon type="settings" color="#94a3b8" size={15} />
            {/* Category picker */}
            <TouchableOpacity style={s.picker} onPress={() => setCatOpen(true)}>
              <Text style={s.pickerText}>{category || 'All Categories'}</Text>
              <Text style={s.pickerArrow}>▾</Text>
            </TouchableOpacity>
            {/* Status picker */}
            <TouchableOpacity style={s.picker} onPress={() => setStatusOpen(true)}>
              <Text style={s.pickerText}>{status || 'All Statuses'}</Text>
              <Text style={s.pickerArrow}>▾</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Campaign Cards ── */}
        {loading ? (
          <View style={s.centerBox}>
            <ActivityIndicator size="large" color="#7c3aed" />
            <Text style={s.loadingTxt}>{loadingText || 'Filtering campaigns...'}</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>📭</Text>
            <Text style={s.emptyTitle}>No Campaigns Found</Text>
            <Text style={s.emptySub}>No campaign records match your search or filter rules. Create one to get started!</Text>
          </View>
        ) : (
          filtered.map(camp => {
            const bannerUri = getBannerUri(camp);
            return (
              <TouchableOpacity
                key={camp.id}
                style={s.card}
                activeOpacity={0.92}
                onPress={() => handleSelectCampaign(camp)}
              >
                {/* Banner */}
                <View style={s.banner}>
                  {bannerUri ? (
                    <Image source={{ uri: bannerUri }} style={s.bannerImg} resizeMode="cover" />
                  ) : (
                    <View style={s.bannerGradient}>
                      <View style={s.blobTR} />
                      <View style={s.blobBL} />
                      <SvgIcon type="megaphone" color="#fff" size={28} />
                      <Text style={s.bannerTitle} numberOfLines={1}>{camp.title}</Text>
                      <Text style={s.bannerCat}>{camp.category}</Text>
                    </View>
                  )}

                  {/* QR + quick actions overlay */}
                  <TouchableOpacity style={s.qrOverlay} onPress={() => {}} activeOpacity={1}>
                    <QRPlaceholder size={38} />
                    <View style={s.qrActions}>
                      <TouchableOpacity style={s.qrBtn} onPress={() => Alert.alert('QR', 'QR download requires a QR library.')}>
                        <Text style={s.qrBtnIcon}>⬇</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.qrBtn} onPress={() => handleShare(camp)}>
                        <Text style={s.qrBtnIcon}>{copiedId === camp.id ? '✓' : '⎘'}</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>

                  {/* Status badge */}
                  <View style={[s.statusBadge, { backgroundColor: statusColor(camp.status) }]}>
                    <Text style={s.statusTxt}>{camp.status}</Text>
                  </View>

                  {/* Offline Cache badge */}
                  {offlineIds.includes(camp.id) && (
                    <View style={[s.statusBadge, { backgroundColor: '#10b981', left: 10, right: 'auto' }]}>
                      <Text style={s.statusTxt}>✓ Offline Ready</Text>
                    </View>
                  )}

                  {/* Category badge */}
                  <View style={s.catBadge}>
                    <Text style={s.catBadgeTxt}>{camp.category}</Text>
                  </View>
                </View>

                {/* Content */}
                <View style={s.cardBody}>
                  <Text style={[s.cardTitle, camp.status === 'Published' && { color: '#7c3aed' }]} numberOfLines={1}>
                    {camp.title}
                  </Text>
                  <Text style={s.cardDesc} numberOfLines={2}>
                    {camp.description || 'No campaign description available.'}
                  </Text>
                  <View style={s.cardMeta}>
                    <View style={s.metaItem}>
                      <SvgIcon type="calendar" color="#94a3b8" size={13} />
                      <Text style={s.metaTxt}>{camp.start_date ? camp.start_date.split('T')[0] : 'N/A'}</Text>
                    </View>
                    <View style={s.metaItem}>
                      <SvgIcon type="users" color="#94a3b8" size={13} />
                      <Text style={s.metaCount}>{camp.total_registrations || 0}</Text>
                      <Text style={s.metaTxt}> regs</Text>
                    </View>
                  </View>
                </View>

                {/* Action Bar */}
                <View style={s.actionBar}>
                  <View style={s.actionLeft}>
                    {offlineIds.includes(camp.id) ? (
                      <TouchableOpacity 
                        style={[s.actionBtn, { backgroundColor: '#d1fae5', borderColor: '#10b981' }]} 
                        onPress={() => handleToggleOffline(camp)}
                      >
                        <SvgIcon type="check" color="#10b981" size={16} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity 
                        style={s.actionBtn} 
                        onPress={() => handleToggleOffline(camp)}
                        disabled={isOfflineMode}
                      >
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={isOfflineMode ? '#cbd5e1' : '#475569'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                        </Svg>
                      </TouchableOpacity>
                    )}

                    {user?.role === 'Admin' && (
                      <>
                        <TouchableOpacity style={s.actionBtn} onPress={() => { setCampaignIdToEdit(camp.id); onNavigate('CREATE_CAMPAIGN'); }}>
                          <SvgIcon type="pen" color="#475569" size={16} />
                        </TouchableOpacity>
                        <TouchableOpacity style={s.actionBtn} onPress={() => handleDuplicate(camp)}>
                          <Text style={s.actionSymbol}>⧉</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={() => handleDelete(camp)}>
                          <SvgIcon type="trash" color="#ef4444" size={16} />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                  <View style={s.actionRight}>
                    <TouchableOpacity style={s.shareBtn} onPress={() => handleShare(camp)}>
                      <Text style={s.shareBtnTxt}>{copiedId === camp.id ? '✓ Copied' : '⎘ Share'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.actionBtn} onPress={() => handleSelectCampaign(camp)}>
                      <Text style={s.actionSymbol}>↗</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Category Modal */}
      <Modal visible={catOpen} transparent animationType="fade" onRequestClose={() => setCatOpen(false)}>
        <TouchableOpacity style={s.modalBg} onPress={() => setCatOpen(false)} activeOpacity={1}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Select Category</Text>
            {['', ...CATS].map(c => (
              <TouchableOpacity key={c} style={s.modalItem} onPress={() => { setCategory(c); setCatOpen(false); }}>
                <Text style={[s.modalItemTxt, category === c && s.modalItemActive]}>{c || 'All Categories'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Status Modal */}
      <Modal visible={statusOpen} transparent animationType="fade" onRequestClose={() => setStatusOpen(false)}>
        <TouchableOpacity style={s.modalBg} onPress={() => setStatusOpen(false)} activeOpacity={1}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Select Status</Text>
            {[['', 'All Statuses'], ['Draft', 'Drafts Only'], ['Published', 'Published Active'], ['Closed', 'Closed Archived']].map(([val, label]) => (
              <TouchableOpacity key={val} style={s.modalItem} onPress={() => { setStatus(val); setStatusOpen(false); }}>
                <Text style={[s.modalItemTxt, status === val && s.modalItemActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f1f5f9' },
  // App bar
  appBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', gap: 8 },
  iconBtn: { padding: 6 },
  searchBarWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, gap: 6 },
  searchBarInput: { flex: 1, fontSize: 12, color: '#475569' },
  bellWrap: { position: 'relative', padding: 4 },
  bellIcon: { fontSize: 20 },
  bellDot: { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', borderWidth: 1.5, borderColor: '#fff' },
  // Scroll
  scroll: { padding: 16, paddingBottom: 40, gap: 16 },
  // Hero
  hero: { gap: 8, paddingBottom: 8 },
  heroTitle: { fontSize: 28, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  heroSub: { fontSize: 13, color: '#64748b', fontWeight: '500', lineHeight: 20 },
  createBtn: { backgroundColor: '#7c3aed', borderRadius: 14, paddingVertical: 14, alignItems: 'center', shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 },
  createBtnText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  // Filter panel
  filterPanel: { backgroundColor: '#fff', borderRadius: 16, padding: 14, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  filterSearch: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 9, gap: 8 },
  filterSearchInput: { flex: 1, fontSize: 12, color: '#475569' },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  picker: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  pickerText: { fontSize: 11, color: '#475569', fontWeight: '600', flex: 1 },
  pickerArrow: { fontSize: 10, color: '#94a3b8' },
  // Loading / empty
  centerBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  loadingTxt: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  emptyBox: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 32, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  emptySub: { fontSize: 12, color: '#64748b', textAlign: 'center', lineHeight: 18 },
  // Card
  card: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  // Banner
  banner: { height: BANNER_H, position: 'relative' },
  bannerImg: { width: '100%', height: '100%' },
  bannerGradient: { flex: 1, backgroundColor: '#5b21b6', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 16 },
  blobTR: { position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.1)' },
  blobBL: { position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.12)' },
  bannerTitle: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center' },
  bannerCat: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  // QR overlay
  qrOverlay: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 12, padding: 6, gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
  qrActions: { gap: 4 },
  qrBtn: { padding: 4, borderRadius: 4 },
  qrBtnIcon: { fontSize: 11, color: '#475569', fontWeight: '700' },
  // Badges
  statusBadge: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  statusTxt: { color: '#fff', fontSize: 9, fontWeight: '800' },
  catBadge: { position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(15,23,42,0.6)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  catBadgeTxt: { color: '#fff', fontSize: 9, fontWeight: '700' },
  // Card body
  cardBody: { padding: 16, gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  cardDesc: { fontSize: 12, color: '#64748b', lineHeight: 18 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTxt: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  metaCount: { fontSize: 11, color: '#1e293b', fontWeight: '800' },
  // Action bar
  actionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  actionLeft: { flexDirection: 'row', gap: 8 },
  actionRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  actionBtn: { padding: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10 },
  actionBtnDanger: { borderColor: '#fecaca' },
  actionSymbol: { fontSize: 16, color: '#475569', fontWeight: '700' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: '#ddd6fe' },
  shareBtnTxt: { fontSize: 11, fontWeight: '800', color: '#7c3aed' },
  // Modals
  modalBg: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: W * 0.8, gap: 4 },
  modalTitle: { fontSize: 14, fontWeight: '900', color: '#0f172a', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 8 },
  modalItem: { paddingVertical: 10, paddingHorizontal: 4 },
  modalItemTxt: { fontSize: 13, color: '#475569', fontWeight: '600' },
  modalItemActive: { color: '#7c3aed', fontWeight: '800' },
});
