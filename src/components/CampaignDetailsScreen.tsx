import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Image, Share, Alert, Modal, Dimensions,
  Platform, Linking
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { SvgUri } from 'react-native-svg';
import { SvgIcon } from './SvgIcon';
import { API_CALLS } from '../utils/api';
import { OfflineManager } from '../utils/offline';

const { width: W } = Dimensions.get('window');

export interface CampaignDetailsScreenProps {
  campaignId: number;
  serverUrl: string;
  token: string;
  onClose: () => void;
  onNavigate: (screen: string) => void;
  setCampaignIdToEdit: (id: number | null) => void;
  onSelectCampaign: (campaign: any) => void;
  user?: any;
  isOfflineMode?: boolean;
}

export const CampaignDetailsScreen: React.FC<CampaignDetailsScreenProps> = ({
  campaignId, serverUrl, token, onClose, onNavigate, setCampaignIdToEdit, onSelectCampaign, user, isOfflineMode = false
}) => {
  const [campaign, setCampaign] = useState<any>(null);
  const [campaignFields, setCampaignFields] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [regFields, setRegFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [regLoading, setRegLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [localSearch, setLocalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRegs, setTotalRegs] = useState(0);

  // Status Modal & Dropdowns
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [campaignStatusModalOpen, setCampaignStatusModalOpen] = useState(false);
  
  // Participant Profile details drawer
  const [selectedReg, setSelectedReg] = useState<any>(null);
  const [selectedRegDetails, setSelectedRegDetails] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Fetch campaign schema
  const fetchCampaign = async () => {
    try {
      if (isOfflineMode) {
        const cached = await OfflineManager.getCachedCampaigns();
        const found = cached.find(c => c.id === campaignId);
        if (found) {
          setCampaign(found);
          const fields = await OfflineManager.getCachedCampaignFields(campaignId);
          setCampaignFields(fields || []);
        } else {
          Alert.alert('Offline Error', 'This campaign is not downloaded for offline use.');
        }
      } else {
        try {
          const res = await API_CALLS.get(`/campaigns/${campaignId}`, serverUrl, token);
          setCampaign(res.campaign);
          setCampaignFields(res.fields || []);
        } catch (apiErr) {
          // Fallback to cache if exists
          const cached = await OfflineManager.getCachedCampaigns();
          const found = cached.find(c => c.id === campaignId);
          if (found) {
            setCampaign(found);
            const fields = await OfflineManager.getCachedCampaignFields(campaignId);
            setCampaignFields(fields || []);
            Alert.alert('Offline Fallback', 'Cannot reach server. Loaded campaign from offline cache.');
          } else {
            throw apiErr;
          }
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to fetch campaign details.');
    }
  };

  const handleUpdateCampaignStatus = async (newStatus: string) => {
    if (isOfflineMode) {
      Alert.alert('Offline Mode Enabled', 'Cannot modify campaign status while offline.');
      return;
    }
    try {
      const updatedCampaign = {
        title: campaign.title,
        description: campaign.description,
        start_date: campaign.start_date,
        end_date: campaign.end_date,
        category: campaign.category,
        submission_limit: campaign.submission_limit,
        thank_you_message: campaign.thank_you_message,
        registration_id_prefix: campaign.registration_id_prefix,
        status: newStatus
      };
      await API_CALLS.put(`/campaigns/${campaign.id}`, updatedCampaign, serverUrl, token);
      setCampaign({ ...campaign, status: newStatus });
      setCampaignStatusModalOpen(false);
      Alert.alert('Success', `Campaign status changed to ${newStatus}.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update campaign status.');
    }
  };

  const handleShareProfileSummary = async () => {
    if (!selectedRegDetails) return;
    const reg = selectedRegDetails.registration;
    let summary = `Participant Profile Summary\n`;
    summary += `Registration ID: ${reg.registration_id}\n`;
    summary += `Status: ${reg.status}\n`;
    summary += `Date: ${new Date(reg.created_at).toLocaleDateString()}\n\n`;
    
    selectedRegDetails.fields.forEach((f: any) => {
      const val = reg.submitted_data?.[f.field_name];
      if (val !== undefined && val !== null) {
        if (typeof val === 'object' && val.url) {
          summary += `${f.label}: ${serverUrl}${val.url}\n`;
        } else {
          summary += `${f.label}: ${String(val)}\n`;
        }
      }
    });
    
    try {
      await Share.share({
        message: summary,
        title: `Profile_${reg.registration_id}`
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch registrations
  const fetchRegistrations = async () => {
    setRegLoading(true);
    try {
      if (isOfflineMode) {
        const localRegs = await OfflineManager.getOfflineRegistrations();
        const campaignRegs = localRegs.filter(r => r.campaign_id === campaignId);

        let filtered = campaignRegs;
        if (search) {
          const lower = search.toLowerCase();
          filtered = filtered.filter(r => {
            const patientName = (r.submitted_data?.name || r.submitted_data?.['Patient Name'] || r.submitted_data?.['First Name'] || '').toLowerCase();
            return patientName.includes(lower) || String(r.registration_id).toLowerCase().includes(lower);
          });
        }
        if (statusFilter) {
          filtered = filtered.filter(r => r.status === statusFilter);
        }

        setRegistrations(filtered);
        setTotalPages(1);
        setTotalRegs(filtered.length);
      } else {
        let query = `page=${page}&limit=10`;
        if (search) query += `&search=${encodeURIComponent(search)}`;
        if (statusFilter) query += `&status=${encodeURIComponent(statusFilter)}`;

        try {
          const res = await API_CALLS.get(`/registrations/campaign/${campaignId}?${query}`, serverUrl, token);
          const localRegs = await OfflineManager.getOfflineRegistrations();
          const campaignLocalRegs = localRegs.filter(r => r.campaign_id === campaignId);

          setRegistrations([...campaignLocalRegs, ...(res.registrations || [])]);
          setRegFields(res.fields || []);
          setTotalPages(res.pagination?.total_pages || 1);
          setTotalRegs((res.pagination?.total || 0) + campaignLocalRegs.length);
        } catch (apiErr) {
          // Fallback to local offline registrations if online fetch fails
          const localRegs = await OfflineManager.getOfflineRegistrations();
          const campaignRegs = localRegs.filter(r => r.campaign_id === campaignId);
          setRegistrations(campaignRegs);
          setTotalPages(1);
          setTotalRegs(campaignRegs.length);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch registrations', err);
    } finally {
      setRegLoading(false);
    }
  };

  // On mount or campaignId change
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchCampaign(), fetchRegistrations()]).finally(() => {
      setLoading(false);
    });
  }, [campaignId, isOfflineMode]);

  // Handle Search input debounce
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      setSearch(localSearch);
      setPage(1);
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [localSearch]);

  // Re-fetch registrations when page or filters change
  useEffect(() => {
    if (campaign) {
      fetchRegistrations();
    }
  }, [page, search, statusFilter]);

  const handleUpdateStatus = async (regId: number, newStatus: string) => {
    if (isOfflineMode) {
      Alert.alert('Offline Mode Enabled', 'Cannot update status while offline.');
      return;
    }
    try {
      await API_CALLS.put(`/registrations/${regId}/status`, { status: newStatus }, serverUrl, token);
      
      // Update local state list
      setRegistrations(prev => prev.map(r => r.id === regId ? { ...r, status: newStatus } : r));
      
      // Update modal state if open
      if (selectedReg && selectedReg.id === regId) {
        setSelectedReg((prev: any) => ({ ...prev, status: newStatus }));
      }
      
      Alert.alert('Success', `Status updated to ${newStatus}.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update registration status.');
    }
  };

  const openParticipantDetails = async (reg: any) => {
    setSelectedReg(reg);
    setDetailLoading(true);
    try {
      if (reg.isOffline || String(reg.registration_id).startsWith('OFFLINE-')) {
        // Read from local registrations queue
        const localRegs = await OfflineManager.getOfflineRegistrations();
        const found = localRegs.find(r => r.registration_id === reg.registration_id);
        if (found) {
          setSelectedRegDetails({
            registration: found,
            fields: campaignFields,
            files: []
          });
        } else {
          Alert.alert('Error', 'Offline profile details not found.');
        }
      } else {
        if (isOfflineMode) {
          Alert.alert('Offline Mode Enabled', 'Cannot retrieve online participant profile while offline.');
          setSelectedReg(null);
          return;
        }
        const details = await API_CALLS.get(`/registrations/${reg.id}`, serverUrl, token);
        setSelectedRegDetails(details);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not retrieve profile details.');
      setSelectedReg(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCopyLink = async () => {
    const publicUrl = `${serverUrl}/campaign/${campaignId}`;
    await Clipboard.setStringAsync(publicUrl);
    Alert.alert('Copied', 'Public campaign URL copied to clipboard.');
  };

  const handleShareLink = async () => {
    const publicUrl = `${serverUrl}/campaign/${campaignId}`;
    try {
      await Share.share({
        message: `Register for ${campaign?.title || 'our campaign'}: ${publicUrl}`,
        url: publicUrl
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportCSV = async () => {
    try {
      let res = [];
      if (isOfflineMode) {
        const localRegs = await OfflineManager.getOfflineRegistrations();
        res = localRegs.filter(r => r.campaign_id === campaignId);
      } else {
        try {
          res = await API_CALLS.get(`/registrations/export/${campaignId}`, serverUrl, token);
        } catch (apiErr) {
          const localRegs = await OfflineManager.getOfflineRegistrations();
          res = localRegs.filter(r => r.campaign_id === campaignId);
        }
      }

      if (!res || res.length === 0) {
        Alert.alert('Export', 'No submissions found to export.');
        return;
      }
      
      const csvHeaders = ['Registration ID', 'Date', 'Status'];
      const fieldsForExport = regFields.length > 0 ? regFields : campaignFields;
      fieldsForExport.forEach((f: any) => csvHeaders.push(`"${f.label}"`));

      const csvRows = res.map((r: any) => {
        const row = [
          `"${r.registration_id}"`,
          `"${new Date(r.created_at).toLocaleDateString()}"`,
          `"${r.status}"`
        ];
        fieldsForExport.forEach((f: any) => {
          const val = r.submitted_data[f.field_name];
          if (val && typeof val === 'object') {
            const display = val.url ? `${serverUrl}${val.url}` : '[Uploaded Attachment]';
            row.push(`"${display}"`);
          } else {
            const safeVal = val !== undefined && val !== null ? String(val).replace(/"/g, '""') : '';
            row.push(`"${safeVal}"`);
          }
        });
        return row.join(',');
      });

      const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
      
      await Share.share({
        message: csvContent,
        title: `Campaign_${campaignId}_Submissions.csv`
      });
    } catch (err: any) {
      Alert.alert('Export Failed', err.message || 'An error occurred while exporting.');
    }
  };

  const handleOpenFile = async (url: string) => {
    const fullUrl = url.startsWith('http') ? url : `${serverUrl}${url}`;
    try {
      await WebBrowser.openBrowserAsync(fullUrl);
    } catch (err) {
      // Fallback
      Linking.openURL(fullUrl).catch(() => {
        Alert.alert('Error', 'Could not open the file link.');
      });
    }
  };

  if (loading) {
    return (
      <View style={s.centerBox}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={s.loadingText}>Retrieving campaign intelligence...</Text>
      </View>
    );
  }

  if (!campaign) {
    return (
      <View style={s.centerBox}>
        <Text style={s.errorMsg}>Campaign details not found.</Text>
        <TouchableOpacity style={s.backBtn} onPress={onClose}>
          <Text style={s.backBtnTxt}>Back to Directory</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const campaignPublicUrl = `${serverUrl}/campaign/${campaignId}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(campaignPublicUrl)}`;

  const statusBadgeColor = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Verified':
        return { bg: '#e6f4ea', text: '#137333' };
      case 'Rejected':
        return { bg: '#fce8e6', text: '#c5221f' };
      case 'Pending':
      default:
        return { bg: '#fef7e0', text: '#b06000' };
    }
  };

  return (
    <View style={s.container}>
      {/* AppBar */}
      <View style={s.appBar}>
        <TouchableOpacity style={s.backBtnLink} onPress={onClose}>
          <SvgIcon type="back" color="#64748b" size={18} />
          <Text style={s.backBtnLinkTxt}>Back to Campaigns</Text>
        </TouchableOpacity>
        <Text style={s.appBarTitle} numberOfLines={1}>{campaign.title}</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Campaign Info Card */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.badgeRow}>
              <View style={s.categoryBadge}>
                <Text style={s.categoryBadgeTxt}>{campaign.category}</Text>
              </View>
              <TouchableOpacity
                style={[s.statusBadge, campaign.status === 'Published' ? s.publishedBg : (campaign.status === 'Closed' ? s.closedBg : { backgroundColor: '#f1f5f9' }), { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                disabled={user?.role !== 'Admin'}
                onPress={() => setCampaignStatusModalOpen(true)}
              >
                <Text style={[s.statusBadgeTxt, campaign.status === 'Draft' && { color: '#475569' }]}>{campaign.status}</Text>
                {user?.role === 'Admin' && (
                  <Text style={{ fontSize: 8, color: campaign.status === 'Published' ? '#137333' : (campaign.status === 'Closed' ? '#c5221f' : '#475569') }}>▾</Text>
                )}
              </TouchableOpacity>
            </View>
            <Text style={s.title}>{campaign.title}</Text>
            <Text style={s.desc}>{campaign.description || 'No description provided.'}</Text>
          </View>

          <View style={s.metaGrid}>
            <View style={s.metaCol}>
              <Text style={s.metaLabel}>Start Date</Text>
              <Text style={s.metaValue}>{campaign.start_date ? campaign.start_date.split('T')[0] : 'N/A'}</Text>
            </View>
            <View style={s.metaCol}>
              <Text style={s.metaLabel}>End Date</Text>
              <Text style={s.metaValue}>{campaign.end_date ? campaign.end_date.split('T')[0] : 'N/A'}</Text>
            </View>
            <View style={s.metaCol}>
              <Text style={s.metaLabel}>Limit</Text>
              <Text style={s.metaValue}>{campaign.submission_limit ? `${campaign.submission_limit} max` : 'Unlimited'}</Text>
            </View>
          </View>

          <View style={s.actionRow}>
            {user?.role === 'Admin' && (
              <TouchableOpacity style={s.editBtn} onPress={() => { setCampaignIdToEdit(campaignId); onNavigate('CREATE_CAMPAIGN'); }}>
                <Text style={s.editBtnTxt}>Edit Form Builder</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.registerBtn} onPress={() => onSelectCampaign(campaign)}>
              <Text style={s.registerBtnTxt}>Register Participant</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* QR & Sharing Card */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>QR Sharing Asset</Text>
          <View style={s.qrRow}>
            <View style={s.qrWrapper}>
              <Image source={{ uri: qrCodeUrl }} style={s.qrImg} />
            </View>
            <View style={s.sharingDetails}>
              <View style={s.urlContainer}>
                <Text style={s.urlText} numberOfLines={1}>{campaignPublicUrl}</Text>
                <TouchableOpacity style={s.copyBtn} onPress={handleCopyLink}>
                  <Text style={s.copyBtnTxt}>Copy</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={s.shareLinkBtn} onPress={handleShareLink}>
                <Text style={s.shareLinkBtnTxt}>Share Link</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Registrations Dashboard */}
        <View style={s.card}>
          <View style={s.dashboardHeader}>
            <View>
              <Text style={s.dashboardTitle}>Registrations Dashboard</Text>
              <View style={s.submissionsCountBadge}>
                <Text style={s.submissionsCountBadgeTxt}>{totalRegs} Submissions</Text>
              </View>
            </View>
            <TouchableOpacity style={s.exportBtn} onPress={handleExportCSV}>
              <Text style={s.exportBtnTxt}>Export CSV</Text>
            </TouchableOpacity>
          </View>

          {/* Search and filter row */}
          <View style={s.filterContainer}>
            <View style={s.searchBarWrap}>
              <SvgIcon type="search" color="#94a3b8" size={14} />
              <TextInput
                style={s.searchBarInput}
                value={localSearch}
                onChangeText={setLocalSearch}
                placeholder="Search participant details..."
                placeholderTextColor="#94a3b8"
              />
            </View>
            <TouchableOpacity style={s.filterStatusBtn} onPress={() => setStatusMenuOpen(true)}>
              <Text style={s.filterStatusBtnTxt}>{statusFilter || 'All Statuses'}</Text>
              <Text style={s.dropdownArrow}>▾</Text>
            </TouchableOpacity>
          </View>

          {/* Registrations List */}
          {regLoading && registrations.length === 0 ? (
            <View style={s.loadingContainer}>
              <ActivityIndicator size="small" color="#7c3aed" />
              <Text style={s.loadingText}>Fetching registrations...</Text>
            </View>
          ) : registrations.length === 0 ? (
            <View style={s.emptyContainer}>
              <Text style={s.emptyIcon}>📭</Text>
              <Text style={s.emptyText}>No registrations found.</Text>
            </View>
          ) : (
            <View style={s.regList}>
              {registrations.map(r => {
                const colors = statusBadgeColor(r.status);
                // Extract summary data (like Name/Email) from submitted_data
                const summaryValues = [];
                const submitted = r.submitted_data || {};
                
                // Let's find first 2 non-object keys in submitted_data to show as preview details
                let count = 0;
                for (const key in submitted) {
                  if (Object.prototype.hasOwnProperty.call(submitted, key)) {
                    const val = submitted[key];
                    if (val && typeof val !== 'object' && count < 2) {
                      summaryValues.push({ label: key, value: String(val) });
                      count++;
                    }
                  }
                }

                return (
                  <View key={r.id} style={s.regItem}>
                    <View style={s.regItemHeader}>
                      <Text style={s.regId} numberOfLines={1}>{r.registration_id}</Text>
                      <View style={[s.regStatusBadge, { backgroundColor: colors.bg }]}>
                        <Text style={[s.regStatusText, { color: colors.text }]}>{r.status}</Text>
                      </View>
                    </View>
                    
                    <Text style={s.regDate}>{new Date(r.created_at).toLocaleDateString()}</Text>

                    {summaryValues.map((sv, idx) => (
                      <Text key={idx} style={s.regPreviewText} numberOfLines={1}>
                        <Text style={{ fontWeight: '700', color: '#475569' }}>{sv.label}: </Text>
                        {sv.value}
                      </Text>
                    ))}

                    <View style={s.regActions}>
                      <TouchableOpacity style={s.openProfileBtn} onPress={() => openParticipantDetails(r)}>
                        <Text style={s.openProfileBtnTxt}>Open Profile</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <View style={s.paginationRow}>
                  <TouchableOpacity
                    disabled={page === 1}
                    onPress={() => setPage(prev => Math.max(prev - 1, 1))}
                    style={[s.pageBtn, page === 1 && s.disabledPageBtn]}
                  >
                    <Text style={s.pageBtnText}>◀ Prev</Text>
                  </TouchableOpacity>
                  <Text style={s.pageInfoText}>Page {page} of {totalPages}</Text>
                  <TouchableOpacity
                    disabled={page === totalPages}
                    onPress={() => setPage(prev => Math.min(prev + 1, totalPages))}
                    style={[s.pageBtn, page === totalPages && s.disabledPageBtn]}
                  >
                    <Text style={s.pageBtnText}>Next ▶</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Campaign Status Change Modal */}
      <Modal visible={campaignStatusModalOpen} transparent animationType="fade" onRequestClose={() => setCampaignStatusModalOpen(false)}>
        <TouchableOpacity style={s.modalOverlay} onPress={() => setCampaignStatusModalOpen(false)} activeOpacity={1}>
          <View style={s.modalBox}>
            <Text style={s.modalBoxTitle}>Change Campaign Status</Text>
            {[['Draft', 'Draft (Configuring)'], ['Published', 'Published (Active)'], ['Closed', 'Closed (Closed entries)']].map(([val, label]) => (
              <TouchableOpacity key={val} style={s.modalItem} onPress={() => handleUpdateCampaignStatus(val)}>
                <Text style={[s.modalItemText, campaign.status === val && s.modalItemTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Status Filter Dialog Modal */}
      <Modal visible={statusMenuOpen} transparent animationType="fade" onRequestClose={() => setStatusMenuOpen(false)}>
        <TouchableOpacity style={s.modalOverlay} onPress={() => setStatusMenuOpen(false)} activeOpacity={1}>
          <View style={s.modalBox}>
            <Text style={s.modalBoxTitle}>Filter by Status</Text>
            {[['', 'All Statuses'], ['Pending', 'Pending Only'], ['Verified', 'Verified Only'], ['Approved', 'Approved Only'], ['Rejected', 'Rejected Only']].map(([val, label]) => (
              <TouchableOpacity key={val} style={s.modalItem} onPress={() => { setStatusFilter(val); setPage(1); setStatusMenuOpen(false); }}>
                <Text style={[s.modalItemText, statusFilter === val && s.modalItemTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Participant Submission Profile Drawer Modal */}
      <Modal visible={selectedReg !== null} transparent animationType="slide" onRequestClose={() => { setSelectedReg(null); setSelectedRegDetails(null); }}>
        <View style={s.drawerOverlay}>
          <View style={s.drawerContent}>
            {/* Header */}
            <View style={s.drawerHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.drawerTitle}>Participant Profile</Text>
                {selectedReg && (
                  <Text style={s.drawerSubtitle}>ID: {selectedReg.registration_id}</Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {selectedRegDetails && (
                  <TouchableOpacity style={s.drawerCloseBtn} onPress={handleShareProfileSummary}>
                    <Text style={{ fontSize: 13 }}>📤</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.drawerCloseBtn} onPress={() => { setSelectedReg(null); setSelectedRegDetails(null); }}>
                  <Text style={s.drawerCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {detailLoading ? (
              <View style={s.drawerCenter}>
                <ActivityIndicator size="large" color="#7c3aed" />
                <Text style={s.loadingText}>Retrieving profile parameters...</Text>
              </View>
            ) : selectedRegDetails ? (
              <ScrollView contentContainerStyle={s.drawerScroll} showsVerticalScrollIndicator={false}>
                {/* Status Update section */}
                <View style={s.drawerSectionCard}>
                  <Text style={s.drawerSectionTitle}>Current Verification Status</Text>
                  <View style={s.statusSelectRow}>
                    {['Pending', 'Verified', 'Approved', 'Rejected'].map((st) => {
                      const colors = statusBadgeColor(st);
                      const isSelected = selectedReg?.status === st;
                      return (
                        <TouchableOpacity
                          key={st}
                          style={[
                            s.statusSelectBtn,
                            { backgroundColor: isSelected ? colors.bg : '#f1f5f9', borderColor: isSelected ? colors.text : 'transparent' }
                          ]}
                          onPress={() => handleUpdateStatus(selectedReg.id, st)}
                        >
                          <Text style={[s.statusSelectBtnText, { color: isSelected ? colors.text : '#64748b', fontWeight: isSelected ? '800' : '600' }]}>{st}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Submitted responses */}
                <View style={s.drawerSectionCard}>
                  <Text style={s.drawerSectionTitle}>Submitted Field Responses</Text>
                  
                  {selectedRegDetails.fields.map((f: any) => {
                    const value = selectedRegDetails.registration.submitted_data?.[f.field_name];
                    const isFile = ['Single Image Upload', 'Single PDF Upload', 'Signature Upload', 'File Upload', 'Click Photo'].includes(f.field_type) && value?.url;
                    const isMultipleFiles = ['Multiple Image Upload', 'Multiple PDF Upload'].includes(f.field_type) && Array.isArray(value);

                    return (
                      <View key={f.field_name} style={s.responseItem}>
                        <Text style={s.responseLabel}>{f.label}</Text>
                        
                        {isFile ? (
                          <View style={s.filePreviewRow}>
                            {/* If image/photo/signature, render the image */}
                            {['Single Image Upload', 'Signature Upload', 'Click Photo'].includes(f.field_type) ? (
                              value.url.endsWith('.svg') ? (
                                <View style={s.imageFrame}>
                                  <SvgUri width="100%" height="100%" uri={`${serverUrl}${value.url}`} />
                                </View>
                              ) : (
                                <View style={s.imageFrame}>
                                  <Image source={{ uri: `${serverUrl}${value.url}` }} style={s.previewImage} resizeMode="contain" />
                                </View>
                              )
                            ) : (
                              <View style={s.fileBadge}>
                                <Text style={s.fileBadgeText} numberOfLines={1}>{value.filename || 'Document'}</Text>
                              </View>
                            )}
                            <TouchableOpacity style={s.downloadFileBtn} onPress={() => handleOpenFile(value.url)}>
                              <Text style={s.downloadFileBtnTxt}>View File</Text>
                            </TouchableOpacity>
                          </View>
                        ) : isMultipleFiles ? (
                          <View style={s.multipleFilesContainer}>
                            {value.map((fileObj: any, fIdx: number) => (
                              <View key={fIdx} style={s.filePreviewRow}>
                                <View style={s.fileBadge}>
                                  <Text style={s.fileBadgeText} numberOfLines={1}>{fileObj.filename || `File ${fIdx + 1}`}</Text>
                                </View>
                                <TouchableOpacity style={s.downloadFileBtn} onPress={() => handleOpenFile(fileObj.url)}>
                                  <Text style={s.downloadFileBtnTxt}>View File</Text>
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={s.responseValue}>
                            {value !== undefined && value !== null && value !== '' ? String(value) : '-'}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Uploaded Files Metadata List */}
                {selectedRegDetails.files && selectedRegDetails.files.length > 0 && (
                  <View style={s.drawerSectionCard}>
                    <Text style={s.drawerSectionTitle}>Associated Upload Assets ({selectedRegDetails.files.length})</Text>
                    {selectedRegDetails.files.map((file: any) => (
                      <View key={file.id} style={s.assetFileItem}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={s.assetFileName} numberOfLines={1}>{file.file_name}</Text>
                          <Text style={s.assetFileSize}>{(file.file_size / 1024).toFixed(1)} KB • {file.file_type}</Text>
                        </View>
                        <TouchableOpacity style={s.assetOpenBtn} onPress={() => handleOpenFile(file.file_path)}>
                          <Text style={s.assetOpenBtnTxt}>Open</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const s: any = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8fafc'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600'
  },
  errorMsg: {
    fontSize: 15,
    color: '#ef4444',
    fontWeight: '700',
    marginBottom: 16
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12
  },
  backBtnLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  backBtnLinkTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b'
  },
  appBarTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'right'
  },
  scroll: {
    padding: 16,
    gap: 16,
    paddingBottom: 40
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    gap: 8,
    marginBottom: 12
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  categoryBadge: {
    backgroundColor: '#f5f3ff',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20
  },
  categoryBadgeTxt: {
    color: '#7c3aed',
    fontSize: 10,
    fontWeight: '800'
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20
  },
  publishedBg: {
    backgroundColor: '#e6f4ea'
  },
  closedBg: {
    backgroundColor: '#fce8e6'
  },
  statusBadgeTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: '#137333'
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5
  },
  desc: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18
  },
  metaGrid: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
    marginTop: 8
  },
  metaCol: {
    flex: 1,
    gap: 4
  },
  metaLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569'
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12
  },
  editBtn: {
    flex: 1,
    backgroundColor: '#f5f3ff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd6fe'
  },
  editBtnTxt: {
    color: '#7c3aed',
    fontSize: 12,
    fontWeight: '800'
  },
  registerBtn: {
    flex: 1,
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2
  },
  registerBtnTxt: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    paddingBottom: 8
  },
  qrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16
  },
  qrWrapper: {
    width: 90,
    height: 90,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center'
  },
  qrImg: {
    width: '100%',
    height: '100%'
  },
  sharingDetails: {
    flex: 1,
    gap: 8
  },
  urlContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 6,
    alignItems: 'center'
  },
  urlText: {
    flex: 1,
    fontSize: 10,
    color: '#64748b',
    paddingHorizontal: 4
  },
  copyBtn: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  copyBtnTxt: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800'
  },
  shareLinkBtn: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center'
  },
  shareLinkBtnTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569'
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    paddingBottom: 10,
    marginBottom: 12
  },
  dashboardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a'
  },
  submissionsCountBadge: {
    backgroundColor: '#f5f3ff',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 2
  },
  submissionsCountBadgeTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7c3aed'
  },
  exportBtn: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10
  },
  exportBtnTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569'
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  searchBarWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 10 : 5,
    gap: 6
  },
  searchBarInput: {
    flex: 1,
    fontSize: 12,
    color: '#475569'
  },
  filterStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4
  },
  filterStatusBtnTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569'
  },
  dropdownArrow: {
    fontSize: 10,
    color: '#94a3b8'
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 4
  },
  emptyIcon: {
    fontSize: 32
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600'
  },
  regList: {
    gap: 12
  },
  regItem: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
    gap: 6
  },
  regItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  regId: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    flex: 1,
    marginRight: 8
  },
  regStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  regStatusText: {
    fontSize: 9,
    fontWeight: '800'
  },
  regDate: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 4
  },
  regPreviewText: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 15
  },
  regActions: {
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    paddingTop: 8,
    marginTop: 6
  },
  openProfileBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  openProfileBtnTxt: {
    color: '#7c3aed',
    fontSize: 10,
    fontWeight: '800'
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
    paddingTop: 12,
    marginTop: 8
  },
  pageBtn: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  disabledPageBtn: {
    opacity: 0.4
  },
  pageBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569'
  },
  pageInfoText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalBox: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    width: W * 0.8,
    gap: 4
  },
  modalBoxTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    paddingBottom: 6
  },
  modalItem: {
    paddingVertical: 10,
    paddingHorizontal: 4
  },
  modalItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569'
  },
  modalItemTextActive: {
    color: '#7c3aed',
    fontWeight: '800'
  },
  // Participant Details Drawer styles
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end'
  },
  drawerContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 20
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0'
  },
  drawerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a'
  },
  drawerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2
  },
  drawerCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  drawerCloseText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b'
  },
  drawerCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  drawerScroll: {
    padding: 16,
    gap: 16,
    paddingBottom: 32
  },
  drawerSectionCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    padding: 14,
    gap: 12
  },
  drawerSectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    paddingBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3
  },
  statusSelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  statusSelectBtn: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: '#f1f5f9'
  },
  statusSelectBtnText: {
    fontSize: 11,
  },
  responseItem: {
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    paddingBottom: 10,
    gap: 4
  },
  responseLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  responseValue: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '700'
  },
  filePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 10,
    marginTop: 4
  },
  multipleFilesContainer: {
    gap: 6
  },
  imageFrame: {
    width: 120,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden'
  },
  previewImage: {
    width: '100%',
    height: '100%'
  },
  fileBadge: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  fileBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569'
  },
  downloadFileBtn: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  downloadFileBtnTxt: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800'
  },
  assetFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    marginBottom: 6
  },
  assetFileName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155'
  },
  assetFileSize: {
    fontSize: 9,
    color: '#94a3b8',
    marginTop: 2
  },
  assetOpenBtn: {
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  assetOpenBtnTxt: {
    color: '#7c3aed',
    fontSize: 10,
    fontWeight: '800'
  },
  backBtn: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10
  },
  backBtnTxt: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  }
});
