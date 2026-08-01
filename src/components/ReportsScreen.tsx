import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet, Alert, Dimensions, Share
} from 'react-native';
import { SvgIcon } from './SvgIcon';
import { API_CALLS } from '../utils/api';

const { width: W } = Dimensions.get('window');

interface ReportsScreenProps {
  serverUrl: string;
  token?: string;
  onOpenMenu: () => void;
  onSelectCampaign: (id: string) => void;
}

export const ReportsScreen: React.FC<ReportsScreenProps> = ({
  serverUrl, token, onOpenMenu, onSelectCampaign
}) => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchCampaigns = async () => {
    try {
      const res = await API_CALLS.get('/campaigns', serverUrl, token);
      setCampaigns(res.campaigns || []);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load campaigns list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const totalParticipants = campaigns.reduce((s, c) => s + (c.total_registrations || 0), 0);
  const publishedCount = campaigns.filter(c => c.status === 'Published').length;
  const closedCount = campaigns.filter(c => c.status === 'Closed').length;

  const filtered = campaigns.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleExportCSV = async (camp: any) => {
    setExportingId(camp.id);
    try {
      const data = await API_CALLS.get(`/registrations/export/${camp.id}`, serverUrl, token);
      if (!data || data.length === 0) {
        Alert.alert('Info', 'No submissions to export for this campaign.');
        return;
      }

      // Fetch campaign schema for headers
      const schemaRes = await API_CALLS.get(`/campaigns/${camp.id}`, serverUrl, token);
      const fields = schemaRes.fields || [];

      // Format CSV headers and rows
      const headers = ['Registration ID', 'Date', 'Status', ...fields.map((f: any) => `"${f.label}"`)];
      const rows = data.map((r: any) => {
        const base = [
          `"${r.registration_id}"`,
          `"${new Date(r.created_at).toLocaleDateString()}"`,
          `"${r.status}"`,
        ];
        fields.forEach((f: any) => {
          const val = r.submitted_data?.[f.field_name];
          if (val && typeof val === 'object') {
            base.push(`"${val.url ? `${serverUrl}${val.url}` : '[File]'}"`);
          } else {
            base.push(`"${val !== undefined && val !== null ? String(val).replace(/"/g, '""') : ''}"`);
          }
        });
        return base.join(',');
      });

      const csvContent = headers.join(',') + '\n' + rows.join('\n');

      await Share.share({
        message: csvContent,
        title: `registrations-${camp.id}.csv`
      });

    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to export registrations CSV.');
    } finally {
      setExportingId(null);
    }
  };

  const handleDownloadAuditLog = async () => {
    setAuditLoading(true);
    try {
      const res = await API_CALLS.get('/audit', serverUrl, token);
      const logsJson = JSON.stringify(res.logs || [], null, 2);
      await Share.share({
        message: logsJson,
        title: `audit_logs_${Date.now()}.json`
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to download audit logs.');
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <View style={s.container}>
      {/* Top App Bar */}
      <View style={s.appBar}>
        <TouchableOpacity onPress={onOpenMenu} style={s.menuBtn}>
          <SvgIcon type="menu" color="#0f172a" size={22} />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Reports Panel</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Quick stat cards grid */}
        <View style={s.statsGrid}>
          {[
            { label: 'Campaigns', value: campaigns.length, bg: '#eef2ff', ic: '#6366f1' },
            { label: 'Participants', value: totalParticipants, bg: '#ecfdf5', ic: '#10b981' },
            { label: 'Active', value: publishedCount, bg: '#f5f3ff', ic: '#7c3aed' },
          ].map((item, idx) => (
            <View key={idx} style={s.statCard}>
              <Text style={s.statLabel}>{item.label}</Text>
              <Text style={[s.statValue, { color: item.ic }]}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Security Audit Card */}
        <View style={s.auditCard}>
          <View style={s.auditHeader}>
            <Text style={{ fontSize: 18 }}>🛡️</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.auditTitle}>Security Audit Logs</Text>
              <Text style={s.auditSubtitle}>Admin activity & event records</Text>
            </View>
          </View>
          <Text style={s.auditDesc}>
            Contains logins, campaign creation/deletions, registration status changes, and all privileged admin actions for compliance audit.
          </Text>
          <TouchableOpacity style={s.auditBtn} onPress={handleDownloadAuditLog} disabled={auditLoading}>
            {auditLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={s.auditBtnText}>Download Audit Logs (JSON)</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Campaign CSV Exports section */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Campaign CSV Exports</Text>
          <Text style={s.sectionDesc}>Download participant registration data per campaign.</Text>

          {/* Search bar */}
          <View style={s.searchBarWrap}>
            <SvgIcon type="search" color="#94a3b8" size={14} />
            <TextInput
              style={s.searchBarInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search campaigns..."
              placeholderTextColor="#94a3b8"
            />
          </View>

          {loading ? (
            <View style={s.loadingContainer}>
              <ActivityIndicator size="small" color="#7c3aed" />
              <Text style={s.loadingText}>Fetching campaigns list...</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={s.emptyContainer}>
              <Text style={s.emptyIcon}>📭</Text>
              <Text style={s.emptyText}>No campaigns found</Text>
            </View>
          ) : (
            <View style={s.campaignsList}>
              {filtered.map((camp) => (
                <View key={camp.id} style={s.campItem}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={s.campTitle} numberOfLines={1}>{camp.title}</Text>
                    <Text style={s.campMeta}>{camp.total_registrations || 0} participants • {camp.status}</Text>
                  </View>
                  <View style={s.campActions}>
                    <TouchableOpacity
                      style={s.detailsBtn}
                      onPress={() => onSelectCampaign(camp.id)}
                    >
                      <Text style={s.detailsBtnTxt}>Details</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.exportBtn}
                      onPress={() => handleExportCSV(camp)}
                      disabled={exportingId === camp.id}
                    >
                      {exportingId === camp.id ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text style={s.exportBtnTxt}>Export</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
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
  menuBtn: {
    padding: 4
  },
  appBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  scroll: {
    padding: 16,
    gap: 16,
    paddingBottom: 40
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    gap: 4
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase'
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900'
  },
  auditCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 16,
    gap: 12
  },
  auditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  auditTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff'
  },
  auditSubtitle: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2
  },
  auditDesc: {
    fontSize: 11,
    color: '#cbd5e1',
    lineHeight: 16
  },
  auditBtn: {
    backgroundColor: '#475569',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center'
  },
  auditBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
    gap: 12
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a'
  },
  sectionDesc: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 15,
    marginBottom: 4
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8
  },
  searchBarInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a'
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8
  },
  loadingText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600'
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 4
  },
  emptyIcon: {
    fontSize: 28
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600'
  },
  campaignsList: {
    gap: 8
  },
  campItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9'
  },
  campTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a'
  },
  campMeta: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2
  },
  campActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  detailsBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  detailsBtnTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569'
  },
  exportBtn: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center'
  },
  exportBtnTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff'
  }
});
