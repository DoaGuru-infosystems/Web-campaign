import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Image, Modal, StyleSheet, Dimensions } from 'react-native';
import { SvgIcon } from './SvgIcon';
import { styles as globalStyles } from '../styles/theme';
import { API_CALLS } from '../utils/api';

const { width: screenWidth } = Dimensions.get('window');

export interface AllEntriesScreenProps {
  serverUrl: string;
  token?: string;
  onClose: () => void;
  onOpenMenu?: () => void;
  onOpenTestForm?: (registrationId: string, campaignId: string) => void;
  onOpenRegisterForm?: (campaignId: string) => void;
}

export const AllEntriesScreen: React.FC<AllEntriesScreenProps> = ({
  serverUrl,
  token,
  onClose,
  onOpenMenu,
  onOpenTestForm,
  onOpenRegisterForm,
}) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1 });
  const LIMIT = 10;

  // Selected entry modal detail
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const fetchEntries = async (resetPage = false) => {
    setLoading(true);
    const p = resetPage ? 1 : page;
    if (resetPage) setPage(1);

    try {
      const queryParts = [
        `page=${p}`,
        `limit=${LIMIT}`,
      ];
      if (searchVal) queryParts.push(`search=${encodeURIComponent(searchVal)}`);
      if (selectedCampaignId) queryParts.push(`campaign_id=${selectedCampaignId}`);
      if (selectedStatus) queryParts.push(`status=${selectedStatus}`);

      const res = await API_CALLS.get(`/registrations/all?${queryParts.join('&')}`, serverUrl, token);
      setRows(res.registrations || []);
      setCampaigns(res.campaigns || []);
      setPagination(res.pagination || { total: 0, total_pages: 1 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [page, selectedCampaignId, selectedStatus]);

  const handleSearchSubmit = () => {
    fetchEntries(true);
  };

  const handleClearFilters = () => {
    setSearchVal('');
    setSelectedCampaignId('');
    setSelectedStatus('');
    setPage(1);
    // Timeout to make sure state is updated
    setTimeout(() => fetchEntries(true), 10);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Verified':
        return { bg: '#d1fae5', text: '#065f46' };
      case 'Rejected':
        return { bg: '#fee2e2', text: '#991b1b' };
      default:
        return { bg: '#fef3c7', text: '#92400e' };
    }
  };

  const renderValue = (val: any) => {
    if (val === null || val === undefined) return '—';
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'object') {
      if (val.url) {
        return (
          <Image 
            source={{ uri: val.url.startsWith('/') ? `${serverUrl}${val.url}` : val.url }} 
            style={styles.detailImagePreview} 
            resizeMode="contain"
          />
        );
      }
      return JSON.stringify(val);
    }
    return String(val);
  };

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={[styles.topAppBar, { paddingLeft: 8 }]}>
        {onOpenMenu && (
          <TouchableOpacity onPress={onOpenMenu} style={{ padding: 8, marginRight: 4 }}>
            <SvgIcon type="menu" color="#1e293b" size={22} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.appBarTitle}>All Entries</Text>
          <Text style={styles.appBarSubtitle}>{pagination.total} total submissions</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Options */}
      <View style={styles.filterSection}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={searchVal}
            onChangeText={setSearchVal}
            onSubmitEditing={handleSearchSubmit}
            placeholder="Search name, ID, or phone..."
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearchSubmit}>
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dropdownRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollFilters}>
            {/* Campaign Select indicator */}
            <TouchableOpacity 
              style={[styles.filterBadge, selectedCampaignId !== '' && styles.filterBadgeActive]}
              onPress={() => {
                Alert.alert(
                  'Select Campaign',
                  'Choose a campaign to filter registrations:',
                  [
                    { text: 'All Campaigns', onPress: () => setSelectedCampaignId('') },
                    ...campaigns.map(c => ({
                      text: c.title,
                      onPress: () => setSelectedCampaignId(String(c.id))
                    })),
                    { text: 'Cancel', style: 'cancel' }
                  ]
                );
              }}
            >
              <Text style={[styles.filterBadgeText, selectedCampaignId !== '' && styles.filterBadgeActiveText]}>
                {selectedCampaignId ? campaigns.find(c => String(c.id) === selectedCampaignId)?.title || 'Filtered' : 'All Campaigns'}
              </Text>
            </TouchableOpacity>

            {/* Status Selector */}
            {['', 'Pending', 'Verified', 'Approved', 'Rejected'].map(st => (
              <TouchableOpacity
                key={st}
                style={[styles.filterBadge, selectedStatus === st && styles.filterBadgeActive]}
                onPress={() => setSelectedStatus(st)}
              >
                <Text style={[styles.filterBadgeText, selectedStatus === st && styles.filterBadgeActiveText]}>
                  {st || 'All Statuses'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {(selectedCampaignId !== '' || selectedStatus !== '' || searchVal !== '') && (
            <TouchableOpacity style={styles.clearBtn} onPress={handleClearFilters}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingMessage}>Loading registry entries...</Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No Submissions Found</Text>
          <Text style={styles.emptySubText}>Try adjusting your search query or filters.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {rows.map((row) => {
            const statusCol = getStatusColor(row.status);
            return (
              <TouchableOpacity
                key={row.id}
                style={styles.entryCard}
                onPress={() => {
                  setSelectedEntry(row);
                  setIsDetailOpen(true);
                }}
              >
                <View style={styles.entryHeader}>
                  <Text style={styles.regIdText}>{row.registration_id}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusCol.bg }]}>
                    <Text style={[styles.statusText, { color: statusCol.text }]}>
                      {row.status}
                    </Text>
                  </View>
                </View>

                <Text style={styles.entryCampaignName} numberOfLines={1}>
                  {row.campaign_title}
                </Text>

                <View style={styles.entryMeta}>
                  <Text style={styles.metaLabel}>Participant Name:</Text>
                  <Text style={styles.metaValue}>{row.name || 'Anonymous'}</Text>
                </View>

                <View style={styles.entryMeta}>
                  <Text style={styles.metaLabel}>Submitted On:</Text>
                  <Text style={styles.metaValue}>
                    {new Date(row.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Pagination buttons */}
          {pagination.total_pages > 1 && (
            <View style={styles.paginationRow}>
              <TouchableOpacity 
                disabled={page === 1} 
                onPress={() => setPage(p => p - 1)}
                style={[styles.pagBtn, page === 1 && styles.pagBtnDisabled]}
              >
                <Text style={styles.pagBtnText}>Previous</Text>
              </TouchableOpacity>
              <Text style={styles.pagLabel}>
                Page {page} of {pagination.total_pages}
              </Text>
              <TouchableOpacity 
                disabled={page === pagination.total_pages} 
                onPress={() => setPage(p => p + 1)}
                style={[styles.pagBtn, page === pagination.total_pages && styles.pagBtnDisabled]}
              >
                <Text style={styles.pagBtnText}>Next</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* Entry detail sheet modal */}
      {selectedEntry && (
        <Modal visible={isDetailOpen} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Entry Details</Text>
                <TouchableOpacity onPress={() => setIsDetailOpen(false)}>
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.modalScroll}>
                <View style={styles.metaPanel}>
                  <Text style={styles.detailTitle}>Registration Profile</Text>
                  <View style={styles.detailMetaRow}>
                    <Text style={styles.detailMetaLabel}>Reg ID:</Text>
                    <Text style={styles.detailMetaValueMono}>{selectedEntry.registration_id}</Text>
                  </View>
                  <View style={styles.detailMetaRow}>
                    <Text style={styles.detailMetaLabel}>Campaign:</Text>
                    <Text style={styles.detailMetaValue}>{selectedEntry.campaign_title}</Text>
                  </View>
                  <View style={styles.detailMetaRow}>
                    <Text style={styles.detailMetaLabel}>Date Created:</Text>
                    <Text style={styles.detailMetaValue}>
                      {new Date(selectedEntry.created_at).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.detailMetaRow}>
                    <Text style={styles.detailMetaLabel}>Current Status:</Text>
                    <Text style={[styles.detailMetaValue, { fontWeight: '800' }]}>
                      {selectedEntry.status}
                    </Text>
                  </View>
                </View>

                {/* Submitted Questionnaire */}
                <Text style={styles.sectionHeader}>Submitted Answers</Text>
                <View style={styles.answersBlock}>
                  {Object.keys(selectedEntry.submitted_data || {}).map((key) => {
                    const formattedKey = key.replace(/_/g, ' ');
                    const val = selectedEntry.submitted_data[key];
                    return (
                      <View key={key} style={styles.answerItem}>
                        <Text style={styles.answerKey}>{formattedKey}</Text>
                        <View style={styles.answerValContainer}>
                          {renderValue(val)}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Action Buttons Panel */}
              <View style={{
                flexDirection: 'row',
                padding: 16,
                backgroundColor: '#ffffff',
                borderTopWidth: 1,
                borderTopColor: '#e2e8f0',
                gap: 12
              }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: '#0a4a9f',
                    paddingVertical: 12,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 6
                  }}
                  onPress={() => {
                    setIsDetailOpen(false);
                    if (onOpenTestForm && selectedEntry) {
                      onOpenTestForm(selectedEntry.registration_id, selectedEntry.campaign_id);
                    }
                  }}
                >
                  <SvgIcon type="check" color="#ffffff" size={14} />
                  <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13 }}>Test</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: '#10b981',
                    paddingVertical: 12,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 6
                  }}
                  onPress={() => {
                    setIsDetailOpen(false);
                    if (onOpenRegisterForm && selectedEntry) {
                      onOpenRegisterForm(selectedEntry.campaign_id);
                    }
                  }}
                >
                  <SvgIcon type="user" color="#ffffff" size={14} />
                  <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13 }}>Register</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

import { Alert } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topAppBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  appBarTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  appBarSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  closeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  filterSection: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    padding: 12,
    gap: 8,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: '#f8fafc',
  },
  searchBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scrollFilters: {
    flexDirection: 'row',
  },
  filterBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    marginRight: 6,
  },
  filterBadgeActive: {
    backgroundColor: '#e0e7ff',
    borderWidth: 1,
    borderColor: '#818cf8',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  filterBadgeActiveText: {
    color: '#4f46e5',
    fontWeight: '700',
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  clearBtnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingMessage: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
  },
  emptySubText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  entryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  regIdText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    color: '#1e293b',
    fontSize: 13,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  entryCampaignName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4f46e5',
    marginBottom: 8,
  },
  entryMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  metaLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  metaValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 12,
  },
  pagBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#4f46e5',
    borderRadius: 8,
  },
  pagBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  pagBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  pagLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '85%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  modalCloseText: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 13,
  },
  modalScroll: {
    padding: 16,
    paddingBottom: 40,
  },
  metaPanel: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  detailTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#4f46e5',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  detailMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  detailMetaLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  detailMetaValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e293b',
  },
  detailMetaValueMono: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '900',
    color: '#0f172a',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1e293b',
    marginBottom: 10,
  },
  answersBlock: {
    gap: 12,
  },
  answerItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  answerKey: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  answerValContainer: {
    marginTop: 4,
  },
  detailImagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginTop: 4,
    backgroundColor: '#f1f5f9',
  },
});
