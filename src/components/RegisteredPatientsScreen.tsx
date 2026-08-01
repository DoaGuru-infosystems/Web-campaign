import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, Dimensions } from 'react-native';
import { SvgIcon } from './SvgIcon';
import { API_CALLS } from '../utils/api';
import { OfflineManager } from '../utils/offline';

const { width: screenWidth } = Dimensions.get('window');

export interface RegisteredPatientsScreenProps {
  serverUrl: string;
  token?: string;
  onClose: () => void;
  onOpenMenu?: () => void;
  onOpenTestForm: (registrationId: string, campaign: any) => void;
  isOfflineMode?: boolean;
  updateUnsyncedCounts?: () => void;
}

export const RegisteredPatientsScreen: React.FC<RegisteredPatientsScreenProps> = ({
  serverUrl,
  token,
  onClose,
  onOpenMenu,
  onOpenTestForm,
  isOfflineMode = false,
  updateUnsyncedCounts,
}) => {
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [searchVal, setSearchVal] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1 });
  const LIMIT = 15;

  const [offlineCampaignsMap, setOfflineCampaignsMap] = useState<Record<number, any>>({});

  useEffect(() => {
    const loadOfflineCamps = async () => {
      try {
        const camps = await OfflineManager.getCachedCampaigns();
        const map: Record<number, any> = {};
        camps.forEach(c => {
          map[c.id] = c;
        });
        setOfflineCampaignsMap(map);
      } catch (_) {}
    };
    loadOfflineCamps();
  }, []);

  const [selectedRegForTravel, setSelectedRegForTravel] = useState<any>(null);
  const [modalRefer, setModalRefer] = useState(false);
  const [modalTravelToHospital, setModalTravelToHospital] = useState(false);
  const [modalGoingByOwn, setModalGoingByOwn] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);

  const openTravelModal = (row: any) => {
    setSelectedRegForTravel(row);
    setModalRefer(row.refer_to_hospital === 'Yes');
    const travelStr = row.travelling_by || '';
    setModalTravelToHospital(travelStr.includes('Travelling to Hospital'));
    setModalGoingByOwn(travelStr.includes('Going to hospital by own'));
  };

  const saveTravelOptions = async () => {
    if (!selectedRegForTravel) return;
    setModalSaving(true);

    const travelOptions = [];
    if (modalTravelToHospital) travelOptions.push('Travelling to Hospital');
    if (modalGoingByOwn) travelOptions.push('Going to hospital by own');
    const travellingByStr = travelOptions.length > 0 ? travelOptions.join(', ') : 'None';

    const payload = {
      refer_to_hospital: modalRefer ? 'Yes' : 'No',
      travelling_by: travellingByStr,
    };

    try {
      if (isOfflineMode || selectedRegForTravel.isOffline) {
        await OfflineManager.queueTest(
          selectedRegForTravel.registration_id,
          null,
          null,
          modalRefer ? 'Yes' : 'No',
          travellingByStr
        );
        Alert.alert('Saved Offline', 'Referral and travel logistics saved locally on device.');
        if (updateUnsyncedCounts) updateUnsyncedCounts();
      } else {
        await API_CALLS.post(`/registrations/${selectedRegForTravel.registration_id}/test`, payload, serverUrl, token);
      }
      setSelectedRegForTravel(null);
      fetchRegistrations();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save details.');
    } finally {
      setModalSaving(false);
    }
  };

  const fetchRegistrations = async (resetPage = false) => {
    setLoading(true);
    const p = resetPage ? 1 : page;
    if (resetPage) setPage(1);

    try {
      let localRegs = await OfflineManager.getOfflineRegistrations();
      let localTests = await OfflineManager.getOfflineTests();
      const localTestsMap = new Map(localTests.map(t => [t.registrationId, t]));
      
      if (searchVal) {
        const lowerSearch = searchVal.toLowerCase();
        localRegs = localRegs.filter(r => {
          const patientName = getPatientName(r.submitted_data).toLowerCase();
          const idStr = String(r.registration_id || '').toLowerCase();
          return patientName.includes(lowerSearch) || idStr.includes(lowerSearch);
        });
      }

      const formattedLocal = localRegs.map(r => {
        const campaignInfo = offlineCampaignsMap[r.campaign_id] || {};
        const testInfo = localTestsMap.get(r.registration_id);
        const isTestDone = !!testInfo;
        return {
          registration_id: r.registration_id,
          campaign_id: r.campaign_id,
          campaign_title: campaignInfo.title || 'Unsynced Local Patient',
          test_template_id: campaignInfo.test_template_id || null,
          submitted_data: r.submitted_data,
          refer_to_hospital: testInfo?.refer_to_hospital || 'No',
          travelling_by: testInfo?.travelling_by || 'None',
          created_at: r.created_at || new Date().toISOString(),
          isOffline: true,
          test_id: isTestDone ? `OFFLINE-TEST-${r.registration_id}` : null
        };
      });

      if (isOfflineMode) {
        setRegistrations(formattedLocal);
        setPagination({ total: formattedLocal.length, total_pages: 1 });
      } else {
        try {
          const queryParts = [
            `page=${p}`,
            `limit=${LIMIT}`,
          ];
          if (searchVal) queryParts.push(`search=${encodeURIComponent(searchVal)}`);

          const res = await API_CALLS.get(`/registrations/all?${queryParts.join('&')}`, serverUrl, token);
          const serverRegs = (res.registrations || []).map((sr: any) => {
            const localTest = localTestsMap.get(sr.registration_id);
            if (localTest) {
              return {
                ...sr,
                refer_to_hospital: localTest.refer_to_hospital || sr.refer_to_hospital || 'No',
                travelling_by: localTest.travelling_by || sr.travelling_by || 'None',
                test_id: sr.test_id || `OFFLINE-TEST-${sr.registration_id}`,
                isOfflineTestOnly: true
              };
            }
            return sr;
          });
          
          setRegistrations([...formattedLocal, ...serverRegs]);
          setPagination({
            total: (res.pagination?.total || 0) + formattedLocal.length,
            total_pages: res.pagination?.total_pages || 1
          });
        } catch (apiErr) {
          setRegistrations(formattedLocal);
          setPagination({ total: formattedLocal.length, total_pages: 1 });
        }
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to retrieve registered patients.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, [page]);

  const handleSearchSubmit = () => {
    fetchRegistrations(true);
  };

  const handleClearFilters = () => {
    setSearchVal('');
    setPage(1);
    setTimeout(() => fetchRegistrations(true), 10);
  };

  const getPatientName = (submittedData: any) => {
    if (!submittedData) return 'Anonymous';
    const nameKeys = ['name', 'fullname', 'full name', 'patient name', 'first name', 'Name', 'FullName', 'Full Name'];
    for (const key of nameKeys) {
      if (submittedData[key]) return String(submittedData[key]);
    }
    for (const key of Object.keys(submittedData)) {
      if (key.toLowerCase().includes('name')) {
        return String(submittedData[key]);
      }
    }
    return 'Anonymous';
  };

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.topAppBar}>
        {onOpenMenu && (
          <TouchableOpacity onPress={onOpenMenu} style={{ padding: 8, marginRight: 4 }}>
            <SvgIcon type="menu" color="#1e293b" size={22} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.appBarTitle}>Registered Patients</Text>
          <Text style={styles.appBarSubtitle}>{pagination.total} total registrations</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>

      {/* Search Filter Bar */}
      <View style={styles.filterSection}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={searchVal}
            onChangeText={setSearchVal}
            onSubmitEditing={handleSearchSubmit}
            placeholder="Search patient name, ID, or campaign..."
          />
          {searchVal !== '' && (
            <TouchableOpacity style={styles.clearBtn} onPress={handleClearFilters}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearchSubmit}>
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Table Headers */}
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, { flex: 1.5, textAlign: 'left' }]}>Campaign</Text>
        <Text style={[styles.headerCell, { flex: 1.5, textAlign: 'left' }]}>Patient Name</Text>
        <Text style={[styles.headerCell, { flex: 1.1, textAlign: 'center' }]}>Referral</Text>
        <Text style={[styles.headerCell, { flex: 1.3, textAlign: 'center' }]}>Travelling By</Text>
        <Text style={[styles.headerCell, { flex: 0.9, textAlign: 'center' }]}>Test</Text>
        <Text style={[styles.headerCell, { flex: 1.1, textAlign: 'center' }]}>Action</Text>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingMessage}>Loading patient registry...</Text>
        </View>
      ) : registrations.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No Patients Registered</Text>
          <Text style={styles.emptySubText}>There are no registrations matching your search.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {registrations.map((row) => {
            const hasTemplate = !!row.test_template_id;
            const isTestDone = !!row.test_id;
            const patientName = getPatientName(row.submitted_data);

            return (
              <View key={row.id} style={styles.tableRow}>
                {/* Campaign Name Column */}
                <View style={[styles.cell, { flex: 1.5, justifyContent: 'center' }]}>
                  <Text style={styles.campaignText} numberOfLines={2}>
                    {row.campaign_title} {row.isOffline && (
                      <Text style={{ color: '#b45309', fontSize: 9, fontWeight: '800' }}>[OFFLINE]</Text>
                    )}
                  </Text>
                  <Text style={styles.regIdSubtext}>{row.registration_id}</Text>
                </View>

                {/* Patient Name Column */}
                <View style={[styles.cell, { flex: 1.5, justifyContent: 'center' }]}>
                  <Text style={styles.nameText} numberOfLines={2}>
                    {patientName}
                  </Text>
                </View>

                {/* Referral Status Column */}
                <TouchableOpacity 
                  style={[styles.cell, { flex: 1.1, alignItems: 'center', justifyContent: 'center' }]}
                  disabled={!isTestDone}
                  onPress={() => openTravelModal(row)}
                >
                  {isTestDone ? (
                     <View style={[
                       styles.statusBadge, 
                       row.refer_to_hospital === 'Yes' ? styles.statusBadgeReferYes : styles.statusBadgeReferNo
                     ]}>
                       <Text style={[
                         styles.statusBadgeText, 
                         row.refer_to_hospital === 'Yes' ? styles.statusBadgeTextReferYes : styles.statusBadgeTextReferNo
                       ]}>
                         {row.refer_to_hospital || 'No'}
                       </Text>
                     </View>
                  ) : (
                    <Text style={styles.naText}>—</Text>
                  )}
                </TouchableOpacity>

                {/* Travelling By Column */}
                <TouchableOpacity 
                  style={[styles.cell, { flex: 1.3, alignItems: 'center', justifyContent: 'center' }]}
                  disabled={!isTestDone}
                  onPress={() => openTravelModal(row)}
                >
                  {isTestDone ? (
                    <View style={styles.travelTextContainer}>
                      <Text style={styles.travelBadgeText} numberOfLines={2}>
                        {row.travelling_by === 'None' || !row.travelling_by ? 'None' : (
                          row.travelling_by.includes('Travelling to Hospital') && row.travelling_by.includes('Going to hospital by own')
                            ? 'Bus & Self'
                            : row.travelling_by.includes('Travelling to Hospital')
                              ? 'Bus / Veh'
                              : 'Self'
                        )}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.naText}>—</Text>
                  )}
                </TouchableOpacity>

                {/* Test Done Status Column */}
                <View style={[styles.cell, { flex: 0.9, alignItems: 'center', justifyContent: 'center' }]}>
                  {hasTemplate ? (
                    <View style={[
                      styles.statusBadge, 
                      isTestDone ? styles.statusBadgeYes : styles.statusBadgeNo
                    ]}>
                      <Text style={[
                        styles.statusBadgeText, 
                        isTestDone ? styles.statusBadgeTextYes : styles.statusBadgeTextNo
                      ]}>
                        {isTestDone ? 'Yes' : 'No'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.naText}>—</Text>
                  )}
                </View>

                {/* Test Action Button Column */}
                <View style={[styles.cell, { flex: 1.1, alignItems: 'center', justifyContent: 'center' }]}>
                  {hasTemplate ? (
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        isTestDone ? styles.actionBtnDone : styles.actionBtnRun
                      ]}
                      onPress={() => {
                        const campaignObj = {
                          id: row.campaign_id,
                          title: row.campaign_title,
                          test_template_id: row.test_template_id,
                        };
                        onOpenTestForm(row.registration_id, campaignObj);
                      }}
                    >
                      <Text style={styles.actionBtnText}>
                        {isTestDone ? 'Edit' : 'Run'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.naText}>N/A</Text>
                  )}
                </View>
              </View>
            );
          })}

          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <View style={styles.paginationRow}>
              <TouchableOpacity 
                disabled={page === 1} 
                onPress={() => setPage(p => p - 1)}
                style={[styles.pagBtn, page === 1 && styles.pagBtnDisabled]}
              >
                <Text style={styles.pagBtnText}>Prev</Text>
              </TouchableOpacity>
              <Text style={styles.pagLabel}>
                {page} / {pagination.total_pages}
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

      {/* Custom Travel Modal Overlay */}
      {selectedRegForTravel !== null && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Referral & Travel Options</Text>
            <Text style={styles.modalSubtitle}>Patient: {getPatientName(selectedRegForTravel.submitted_data)}</Text>
            
            {/* Question 1: Refer to Hospital */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Refer to Hospital?</Text>
              <View style={styles.modalRow}>
                <TouchableOpacity 
                  style={[styles.modalChoiceBtn, modalRefer && styles.modalChoiceBtnActive]}
                  onPress={() => setModalRefer(true)}
                >
                  <Text style={[styles.modalChoiceText, modalRefer && styles.modalChoiceTextActive]}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalChoiceBtn, !modalRefer && styles.modalChoiceBtnInactiveActive]}
                  onPress={() => {
                    setModalRefer(false);
                    setModalTravelToHospital(false);
                    setModalGoingByOwn(false);
                  }}
                >
                  <Text style={[styles.modalChoiceText, !modalRefer && styles.modalChoiceTextInactiveActiveText]}>No</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Question 2: Travelling By */}
            {modalRefer && (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Travelling By:</Text>
                
                <TouchableOpacity 
                  style={[styles.modalCheckboxRow, modalTravelToHospital && styles.modalCheckboxRowActive]}
                  onPress={() => setModalTravelToHospital(!modalTravelToHospital)}
                >
                  <View style={[styles.modalCheckboxOutline, modalTravelToHospital && styles.modalCheckboxChecked]}>
                    {modalTravelToHospital && <Text style={styles.modalCheckmark}>✓</Text>}
                  </View>
                  <Text style={styles.modalCheckboxLabel}>Travelling to Hospital (Vehicle / Bus)</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.modalCheckboxRow, modalGoingByOwn && styles.modalCheckboxRowActive]}
                  onPress={() => setModalGoingByOwn(!modalGoingByOwn)}
                >
                  <View style={[styles.modalCheckboxOutline, modalGoingByOwn && styles.modalCheckboxChecked]}>
                    {modalGoingByOwn && <Text style={styles.modalCheckmark}>✓</Text>}
                  </View>
                  <Text style={styles.modalCheckboxLabel}>Going to hospital by own</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Actions */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity 
                style={styles.modalCancelBtn} 
                onPress={() => setSelectedRegForTravel(null)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalSaveBtn} 
                onPress={saveTravelOptions}
                disabled={modalSaving}
              >
                {modalSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

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
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
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
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  clearBtn: {
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  clearBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  headerCell: {
    fontSize: 11,
    fontWeight: '900',
    color: '#475569',
    textTransform: 'uppercase',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginVertical: 4,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  cell: {
    paddingHorizontal: 4,
  },
  campaignText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  regIdSubtext: {
    fontSize: 9,
    color: '#94a3b8',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  nameText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeYes: {
    backgroundColor: '#d1fae5',
  },
  statusBadgeNo: {
    backgroundColor: '#fee2e2',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusBadgeTextYes: {
    color: '#065f46',
  },
  statusBadgeTextNo: {
    color: '#991b1b',
  },
  naText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    width: '100%',
  },
  actionBtnRun: {
    backgroundColor: '#0a4a9f',
  },
  actionBtnDone: {
    backgroundColor: '#10b981',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    marginTop: 48,
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
    marginTop: 48,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
  },
  emptySubText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
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
  statusBadgeReferYes: {
    backgroundColor: '#fee2e2',
  },
  statusBadgeReferNo: {
    backgroundColor: '#f1f5f9',
  },
  statusBadgeTextReferYes: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '800',
  },
  statusBadgeTextReferNo: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
  },
  travelTextContainer: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: '100%',
    alignItems: 'center',
  },
  travelBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1d4ed8',
    textAlign: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 340,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 16,
  },
  modalSection: {
    marginBottom: 16,
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 8,
  },
  modalRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modalChoiceBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  modalChoiceBtnActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#e0e7ff',
  },
  modalChoiceBtnInactiveActive: {
    borderColor: '#fee2e2',
    backgroundColor: '#fef2f2',
  },
  modalChoiceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  modalChoiceTextActive: {
    color: '#4f46e5',
  },
  modalChoiceTextInactiveActiveText: {
    color: '#ef4444',
  },
  modalCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
  },
  modalCheckboxRowActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#f5f3ff',
  },
  modalCheckboxOutline: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#ffffff',
  },
  modalCheckboxChecked: {
    borderColor: '#4f46e5',
    backgroundColor: '#4f46e5',
  },
  modalCheckmark: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  modalCheckboxLabel: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  modalCancelBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  modalSaveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#4f46e5',
    minWidth: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSaveBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
